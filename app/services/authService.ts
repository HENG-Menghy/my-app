// @/services/authService.ts

import bcrypt from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/errors";
import { AUTH_CONSTANTS } from "@/lib/auth/constants";
import { RedisClient } from "@/lib/auth/redis";
import { emailService } from "./emailService";
import { otpService } from "./otpService";
import { tokenService } from "./tokenService";
import type {
  LoginCredentials,
  RegisterInitialData,
  RegisterVerifyData,
  RegisterCompleteData,
  PasswordResetInitData,
  PasswordResetVerifyData,
  PasswordResetCompleteData,
  ChangePasswordData,
  SessionMetadata,
  AuthResponse,
  UserProfile,
} from "@/types/auth";
import {
  AuthEventStatus,
  AuthEventType,
  UserGender,
  UserStatus,
} from "@prisma/client";
import { fromUTCToLocal } from "@/utils/datetime";
import { Logger } from "@/lib/logger";

class AuthService {
  private async validateSecurity(
    identifier: string,
    action: keyof typeof AUTH_CONSTANTS.RATE_LIMITS,
    securityContext?: SessionMetadata
  ) {
    const rateLimitInfo = await RedisClient.checkRateLimit(
      action,
      identifier,
      AUTH_CONSTANTS.RATE_LIMITS[action]
    );

    if (!rateLimitInfo.allowed) {
      // If account is blocked due to too many attempts, send notification
      if (rateLimitInfo.blocked && action === "LOGIN") {
        const user = await prisma.user.findUnique({
          where: { email: identifier },
        });
        if (user) {
          Logger.debug("ACCOUNT_LOCKED", {
            ...securityContext,
            actor: user.email,
            action: "Account locked due to multiple failed login attempts",
          });

          // Create an auth event to log the account lock action
          const authEvent = await prisma.authEvent.create({
            data: {
              userId: user.id,
              type: AuthEventType.ACCOUNT_LOCKED,
              status: AuthEventStatus.failure,
            },
          });

          await Promise.all([
            emailService.sendAccountLockedEmail(user.email, user.fullname),
            prisma.user.update({
              where: { email: identifier },
              data: { status: UserStatus.suspended },
            }),

            // Create a session record to capture metadata for audit/logging
            prisma.session.create({
              data: {
                userId: user.id,
                eventId: authEvent.id,
                metadata: {
                  ...securityContext,
                  actor: user.email,
                  action:
                    "Account locked due to multiple failed login attempts",
                },
              },
            }),
          ]);
        }
      }
      throw AuthError.tooManyAttempts(rateLimitInfo.resetIn);
    }
  }

  async login(
    credentials: LoginCredentials,
    securityContext?: SessionMetadata
  ): Promise<AuthResponse> {
    // Validate rate limiting
    await this.validateSecurity(credentials.email, "LOGIN", securityContext);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    // Record an audit log for a failed login attempt
    if (user && !(await bcrypt.compare(credentials.password, user.password))) {
      Logger.debug("LOGIN_FAILED", {
        ...securityContext,
        actor: user.email,
        action: "Login failed due to an incorrect password",
      });

      // Create an auth event to log the failed login attempt
      const authEvent = await prisma.authEvent.create({
        data: {
          userId: user.id,
          type: AuthEventType.LOGIN,
          status: AuthEventStatus.failure,
        },
      });

      // Create a session record to capture metadata for audit/logging
      await prisma.session.create({
        data: {
          userId: user.id,
          eventId: authEvent.id,
          metadata: {
            ...securityContext,
            actor: user.email,
            action: "Login failed due to an incorrect password",
          },
        },
      });
    }

    // Validate credentials
    if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
      Logger.debug("LOGIN_FAILED", {
        ...securityContext,
        actor: credentials.email,
        action: "Login failed due to invalid credentials",
      });

      throw AuthError.invalidCredentials();
    }

    // Check user status
    if (user.status === UserStatus.suspended) {
      throw AuthError.accountLocked();
    }

    // Check if email verified
    if (!user.emailVerified) {
      throw AuthError.emailNotVerified();
    }

    // Create an auth event and associated session upon successful login
    const authEvent = await prisma.authEvent.create({
      data: {
        userId: user.id,
        type: AuthEventType.LOGIN,
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        eventId: authEvent.id,
        expiresAt: new Date(Date.now() + AUTH_CONSTANTS.SESSION_EXPIRY * 1000),
        metadata: { ...securityContext },
      },
    });

    // Generate tokens
    const tokens = await tokenService.generateAuthTokens({
      uid: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
    });

    // Update last login with active status and send login alert
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          status: UserStatus.active,
        },
      }),
      emailService.sendLoginAlertEmail(user.email, user.fullname, {
        time: new Date().toISOString(),
        ipAddress: securityContext?.ipAddress,
        userAgent: securityContext?.userAgent,
        location: securityContext?.location,
        os: securityContext?.deviceInfo?.os,
        browser: securityContext?.deviceInfo?.browser,
      }),
    ]);

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
      },
      session: {
        id: session.id,
        expiresAt: fromUTCToLocal(session.expiresAt!).toFormat(
          "yyyy LLL dd hh:mm:ss a"
        ),
      },
      tokens,
    };
  }

  async initiateRegistration(data: RegisterInitialData): Promise<void> {
    // Validate rate limiting
    await this.validateSecurity(data.email, "OTP_REQUEST");

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw AuthError.emailTaken();
    }

    // Generate and send OTP
    const otp = await otpService.generateOTP(data.email, "VERIFY_EMAIL");
    await emailService.sendVerificationEmail(data.email, otp);
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
    securityContext?: SessionMetadata
  ): Promise<void> {
    // Check if email or phone exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phonenumber: data.phonenumber }],
      },
    });

    if (existingUser) {
      throw new AuthError(
        "ACCOUNT_EXISTS",
        existingUser.email === data.email
          ? "Email address is already registered"
          : "Phone number is already registered"
      );
    }

    // Verify if registration was initiated and OTP was verified
    const otpData = await otpService.getOTPData(data.email, "VERIFY_EMAIL");
    if (!otpData || !otpData.verified) {
      Logger.error(
        "REGISTRATION_FAILED",
        new Error(
          "Registration incomplete. Please verify your email address using the OTP before continuing."
        )
      );

      throw AuthError.emailNotVerified();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        fullname: data.fullname,
        phonenumber: data.phonenumber,
        gender: data.gender,
        imageUrl:
          data.imageUrl ?? `${data.gender === UserGender.male ? "" : ""}`,
        emailVerified: new Date(),
      },
    });

    // Create an auth event and associated session upon successful register
    const authEvent = await prisma.authEvent.create({
      data: {
        userId: user.id,
        type: AuthEventType.REGISTER,
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        eventId: authEvent.id,
        metadata: { ...securityContext },
      },
    });

    // Clear OTP data and send welcome email
    await Promise.all([
      otpService.clearOTPData(data.email, "VERIFY_EMAIL"),
      emailService.sendWelcomeEmail({
        email: user.email,
        fullname: user.fullname,
      }),
    ]);
  }

  async initiatePasswordReset(data: PasswordResetInitData): Promise<void> {
    // Validate rate limiting
    await this.validateSecurity(data.email, "OTP_REQUEST");

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return;
    }

    // Generate and send OTP
    const otp = await otpService.generateOTP(data.email, "RESET_PASSWORD");
    await emailService.sendPasswordResetEmail({
      email: user.email,
      fullname: user.fullname,
      resetCode: otp,
      expiresInMinutes: AUTH_CONSTANTS.OTP_EXPIRY / 60,
    });
  }

  async verifyPasswordResetOTP(data: PasswordResetVerifyData): Promise<void> {
    await otpService.verifyOTP(data.email, data.otp, "RESET_PASSWORD");
  }

  async completePasswordReset(data: PasswordResetCompleteData): Promise<void> {
    // Verify OTP one last time
    await otpService.verifyOTP(data.email, data.otp, "RESET_PASSWORD");

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw AuthError.accountNotFound();
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    // Invalidate all sessions and clear OTP
  }

  async changePassword(
    userId: string,
    data: ChangePasswordData
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AuthError.accountNotFound();
    }

    // Verify current password
    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      throw new AuthError(
        "INVALID_CURRENT_PASSWORD",
        "Current password is invalid"
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    // Invalidate all other sessions
  }

  async logout(userId: string, sessionId: string): Promise<void> {}

  async logoutAll(userId: string, currentSessionId?: string): Promise<void> {}

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AuthError.accountNotFound();
    }

    return {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      phonenumber: user.phonenumber,
      gender: user.gender,
      imageUrl: user.imageUrl,
      role: user.role,
      status: user.status,
      emailVerified: !!user.emailVerified,
      lastLoginAt: fromUTCToLocal(user.lastLoginAt!).toJSDate(),
    };
  }
}

export const authService = new AuthService();
