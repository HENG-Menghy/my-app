// @/services/authService.ts

import bcrypt from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/errors";
import { AUTH_CONSTANTS, REDIS_PREFIXES } from "@/lib/constants";
import { UpstashRedis } from "@/lib/upstash-redis";
import { otpService } from "./otpService";
import { tokenService } from "./tokenService";
import type {
  LoginCredentials,
  RegisterInitialData,
  RegisterVerifyData,
  RegisterCompleteData,
  PasswordResetInitialData,
  PasswordResetVerifyData,
  PasswordResetCompleteData,
  ChangePasswordData,
  SessionMetadata,
  AuthTokens,
  ProfileUpdateData,
  ProfileData,
} from "@/types/auth";
import {
  AuthEventStatus,
  AuthEventType,
  UserGender,
  UserStatus,
} from "@prisma/client";
import { Logger } from "@/lib/logger";
import { RateLimitActions, RateLimitInfo } from "@/types/redis";
import { qstashClient } from "@/lib/upstash-qstash";
import { sessionService } from "./sessionService";
import { normalizeTruthySession } from "@/utils/normalizeTruthySession";
import {
  AccountRemovalEmailData,
  EmailTypes,
  LoginAlertEmailData,
  PasswordResetEmailData,
  VerificationEmailData,
  WelcomeEmailData,
} from "@/types/email";

class AuthService {
  private async validateSecurity(
    email: string,
    action: RateLimitActions,
    metadata: SessionMetadata
  ): Promise<void> {
    const incomingSession = normalizeTruthySession(metadata, email);

    // Find user and active sessions by email
    const [user, sessions] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
      prisma.session.findMany({
        where: {
          user: { email },
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        select: { metadata: true },
      }),
    ]);

    // Extract truth sessions
    const truthySessions = sessions.map((session) =>
      normalizeTruthySession(
        session.metadata as unknown as SessionMetadata,
        email
      )
    );

    const isTruth =
      !!incomingSession && truthySessions.includes(incomingSession);

    // Checking rate limit for per user attempts to sensitive endpoints
    const userId = isTruth ? user!.id : null;
    const identifier = isTruth ? email : metadata.ipAddress;
    const rateLimitInfo: RateLimitInfo = await UpstashRedis.checkRateLimit(
      identifier,
      action,
      AUTH_CONSTANTS.RATE_LIMITS[action]
    );

    if (!rateLimitInfo.allowed) {
      const wasNotifiedKey = `notified:${REDIS_PREFIXES.RATE_LIMIT}${action}:${identifier}`;

      // Check if already notified
      const alreadyNotified = await UpstashRedis.get(wasNotifiedKey);
      if (!alreadyNotified) {
        // Create an auth event and a session record
        await Promise.all([
          sessionService.auditLog(
            userId,
            action,
            AuthEventStatus.failure,
            identifier,
            "Exceeded daily attempt limit"
          ),
          UpstashRedis.set(
            wasNotifiedKey,
            `Rate limit exceeded for ‘${action}’ action`,
            rateLimitInfo.resetIn
          ),
        ]);
      }

      throw AuthError.tooManyAttempts(rateLimitInfo.resetIn);
    }
  }

  async login(
    credentials: LoginCredentials,
    metadata: SessionMetadata
  ): Promise<AuthTokens> {
    // Validate rate limiting
    await this.validateSecurity(credentials.email, "LOGIN", metadata);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    // Validate credentials
    if (!user) {
      // Create an auth event and a session record
      await sessionService.auditLog(
        null,
        AuthEventType.LOGIN,
        AuthEventStatus.failure,
        "ANONYMOUS",
        "Invalid credentials"
      );
      throw AuthError.invalidCredentials();
    } else if (
      user &&
      !(await bcrypt.compare(credentials.password, user.password))
    ) {
      // Create an auth event and a session record
      await sessionService.auditLog(
        user.id,
        AuthEventType.LOGIN,
        AuthEventStatus.failure,
        credentials.email,
        "Incorrect password"
      );
      throw AuthError.invalidCredentials();
    }

    // Create an auth event and associated session upon successful login
    const { session } = await sessionService.createSessionWithAuthEvent({
      userId: user.id,
      type: AuthEventType.LOGIN,
      status: AuthEventStatus.success,
      actor: credentials.email,
      reason: null,
      revoked: false,
      revokedAt: null,
      expiresAt: new Date(Date.now() + AUTH_CONSTANTS.SESSION_EXPIRY * 1000),
      metadata,
    });

    // Cache active (valid) session in Redis
    await sessionService.cacheSession(session);

    // Generate tokens
    const tokens = await tokenService.generateAuthTokens({
      uid: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
    });

    // Update user's last login/status and trigger login alert email in background
    await Promise.allSettled([
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          status: UserStatus.active,
        },
      }),
      qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
        body: {
          type: EmailTypes.loginAlertEmail,
          email: user.email,
          fullname: user.fullname,
          loginInfo: {
            time: new Date().toISOString(),
            device: metadata?.device.model,
            os: metadata?.os,
            browser: metadata?.browser,
            location: metadata?.location,
          },
        } as LoginAlertEmailData,
      }),
    ]);

    return tokens;
  }

  async initiateRegistration(
    data: RegisterInitialData,
    metadata: SessionMetadata
  ): Promise<void> {
    // Check if email is blocked from registration
    const blockKey = `${REDIS_PREFIXES.BLOCK}registration:${data.email}`;
    const isEmailBlocked = await UpstashRedis.get(blockKey);
    const blockTTL = await UpstashRedis.ttl(blockKey);
    if (isEmailBlocked) {
      throw AuthError.emailBlocked(blockTTL);
    }

    // Validate rate limiting
    await this.validateSecurity(data.email, "OTP_VERIFY", metadata);

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw AuthError.emailTaken();
    }

    // Generate OTP and trigger background verification email
    const otp = await otpService.generateOTP(data.email, "VERIFY_EMAIL");
    await Promise.allSettled([
      qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
        body: {
          type: EmailTypes.verificationEmail,
          email: data.email,
          otp,
          expiry: AUTH_CONSTANTS.OTP_EXPIRY,
        } as VerificationEmailData,
      }),
    ]);
  }

  async verifyRegistrationOTP(data: RegisterVerifyData): Promise<void> {
    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw AuthError.emailTaken();
    }

    await otpService.verifyOTP(data.email, data.otp, "VERIFY_EMAIL");
  }

  async completeRegistration(
    data: RegisterCompleteData,
    metadata: SessionMetadata
  ): Promise<void> {
    // Check if email exists
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
    });

    if (existingUser) {
      throw AuthError.emailTaken();
    }

    // Verify if registration was initiated and OTP is still valid
    const otpData = await otpService.getOTPData(data.email, "VERIFY_EMAIL");
    if (!otpData || !otpData.verified) {
      // Create an auth event and a session record
      await sessionService.auditLog(
        null,
        AuthEventType.REGISTER,
        AuthEventStatus.failure,
        "ANONYMOUS",
        "Email verification has expired or is not completed"
      );
      Logger.error(
        "REGISTRATION_FAILED",
        new Error(
          "Email verification OTP has expired or the email was never verified within the allowed 10-minute window."
        )
      );

      throw new AuthError(
        "REGISTRATION_FAILED",
        "Email verification has expired or is not completed.",
        403
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Get default image url if not provided
    let defaultImageUrl = "";
    if (!data.imageUrl) {
      defaultImageUrl =
        data.gender === UserGender.male
          ? "https://lpymuofbexgjrijarltz.supabase.co/storage/v1/object/public/images-bucket/profiles/male_profile.jpg"
          : "https://lpymuofbexgjrijarltz.supabase.co/storage/v1/object/public/images-bucket/profiles/female_profile.jpg";
    }

    // Create user, auth event, and registration session atomically
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        fullname: data.fullname,
        phonenumber: data.phonenumber,
        gender: data.gender,
        imageUrl: data.imageUrl ?? defaultImageUrl,
        emailVerified: true,
      },
    });

    // Create an auth event
    await sessionService.auditLog(
      user.id,
      AuthEventType.REGISTER,
      AuthEventStatus.success,
      data.email,
      null
    );

    // Clear OTP data and trigger welcome email in the background
    await Promise.allSettled([
      otpService.clearOTPData(data.email, "VERIFY_EMAIL"),
      UpstashRedis.del(
        `${REDIS_PREFIXES.RATE_LIMIT}OTP_VERIFY:${metadata.ipAddress}`
      ),
      qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
        body: {
          type: EmailTypes.welcomeEmail,
          email: user.email,
          fullname: user.fullname,
        } as WelcomeEmailData,
      }),
    ]);
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    changePasswordData: ChangePasswordData,
    metadata: SessionMetadata
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, password: true },
    });
    if (!user) throw AuthError.accountNotFound();

    // Check if password is valid
    const isPasswordValid = await bcrypt.compare(
      changePasswordData.currentPassword,
      user.password
    );
    if (isPasswordValid) {
      // Update and hash new password
      const hashedPassword = await bcrypt.hash(
        changePasswordData.newPassword,
        12
      );
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // After successfully changed password
      await Promise.all([
        // Validate rate limiting
        this.validateSecurity(user.email, "PASSWORD_CHANGE", metadata),

        // Audit log
        sessionService.auditLog(
          userId,
          AuthEventType.PASSWORD_CHANGE,
          AuthEventStatus.success,
          user.email,
          null
        ),

        // Log out user sessions except the current one
        this.logoutAll(userId, currentSessionId),
      ]);
    } else {
      throw new AuthError(
        "PASSWORD_CHANGE_FAILED",
        "Current password is incorrect",
        400
      );
    }
  }

  async initiatePasswordReset(
    data: PasswordResetInitialData,
    metadata: SessionMetadata
  ): Promise<void> {
    // Validate rate limiting
    await this.validateSecurity(data.email, "OTP_RESET", metadata);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return;
    }

    // Generate OTP and trigger password reset email in the background
    const otp = await otpService.generateOTP(data.email, "RESET_PASSWORD");
    await Promise.allSettled([
      qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
        body: {
          type: EmailTypes.passwordResetEmail,
          email: user.email,
          fullname: user.fullname,
          otp,
          expiry: AUTH_CONSTANTS.OTP_EXPIRY,
        } as PasswordResetEmailData,
      }),
    ]);
  }

  async verifyPasswordResetOTP(data: PasswordResetVerifyData): Promise<void> {
    await otpService.verifyOTP(data.email, data.otp, "RESET_PASSWORD");
  }

  async completePasswordReset(
    data: PasswordResetCompleteData,
    metadata: SessionMetadata
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true },
    });
    if (!user) throw AuthError.accountNotFound();

    // Verify if OTP is still valid for password reset
    const otpData = await otpService.getOTPData(data.email, "RESET_PASSWORD");
    if (!otpData || !otpData.verified) {
      // Create an auth event
      await sessionService.auditLog(
        user.id,
        AuthEventType.PASSWORD_RESET,
        AuthEventStatus.failure,
        user.email,
        "OTP expired or not verified within the allowed 10-minute window"
      );
      Logger.error(
        "PASSWORD_RESET_FAILED",
        new Error(
          "Password reset failed: OTP expired or not verified within 10 minutes"
        )
      );

      throw new AuthError(
        "PASSWORD_RESET_FAILED",
        "The password reset code has expired or was not verified within 10 minutes. Please request a new one.",
        403
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await Promise.all([
      // Validate rate limiting
      this.validateSecurity(user.email, "PASSWORD_RESET", metadata),

      // Create an auth event
      sessionService.auditLog(
        user.id,
        AuthEventType.PASSWORD_RESET,
        AuthEventStatus.success,
        data.email,
        null
      ),

      // Logout all and clear OTP data
      this.logoutAll(user.id),
      otpService.clearOTPData(user.email, "RESET_PASSWORD"),
    ]);
  }

  async viewProfile(userId: string): Promise<ProfileData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phonenumber: true,
        fullname: true,
        gender: true,
        role: true,
        status: true,
        imageUrl: true,
        emailVerified: true,
        lastLoginAt: true,
        passwordChangedAt: true,
      },
    });

    if (!user) throw AuthError.accountNotFound();

    return user;
  }

  async updateProfile(
    userId: string,
    profileUpdateData: ProfileUpdateData,
    metadata: SessionMetadata
  ): Promise<ProfileData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw AuthError.accountNotFound();

    // Update profile info
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: profileUpdateData,
      select: {
        id: true,
        email: true,
        phonenumber: true,
        fullname: true,
        gender: true,
        role: true,
        status: true,
        imageUrl: true,
        emailVerified: true,
        lastLoginAt: true,
        passwordChangedAt: true,
      },
    });

    // After profile updated successfully
    await Promise.all([
      // Validate rate limiting
      this.validateSecurity(user.email, "UPDATE_PROFILE", metadata),

      // Create an auth event
      sessionService.auditLog(
        user.id,
        AuthEventType.UPDATE_PROFILE,
        AuthEventStatus.success,
        user.email,
        null
      ),
    ]);

    return updatedUser;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullname: true },
    });
    if (!user) throw AuthError.accountNotFound();

    // Delete user
    await prisma.user.delete({ where: { id: userId } });

    // After account is deleted, block new account registration for 3 days
    const { id, email, fullname } = user;
    const key = `${REDIS_PREFIXES.BLOCK}registration:${email}`;
    await Promise.allSettled([
      // Create an auth event
      sessionService.auditLog(
        id,
        AuthEventType.DELETE_ACCOUNT,
        AuthEventStatus.success,
        email,
        null
      ),

      // Block email for 3 days
      UpstashRedis.set(
        key,
        "Blocked email for account registration",
        AUTH_CONSTANTS.ACCOUNT_BLOCKED_EXPIRY
      ),

      // Send email
      qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`,
        body: {
          type: EmailTypes.registrationBlockedEmail,
          email,
          fullname,
          expiry: AUTH_CONSTANTS.ACCOUNT_BLOCKED_EXPIRY,
        } as AccountRemovalEmailData,
      }),
    ]);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw AuthError.accountNotFound();

    await Promise.all([
      sessionService.revokeSession(sessionId),
      sessionService.auditLog(
        userId,
        AuthEventType.LOGOUT,
        AuthEventStatus.success,
        user.email,
        null
      ),
    ]);
  }

  async logoutAll(userId: string, currentSessionId?: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AuthError.accountNotFound();

    // Find sessions to revoke
    const where = currentSessionId
      ? {
          userId,
          NOT: { id: currentSessionId },
        }
      : { userId };
    const revokeSessions = await prisma.session.findMany({
      where,
      select: { id: true },
    });

    // Revoke user’s sessions except the current session if provided
    await sessionService.revokeSessions(revokeSessions.map((s) => s.id));
  }
}

export const authService = new AuthService();
