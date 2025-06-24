// @/lib/auth/errors.ts

import { getTimeDifference } from "@/utils/getTimeDifference";

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "AuthError";
  }

  static unauthorized() {
    return new AuthError("UNAUTHORIZED", "You are not authorized", 401);
  }

  static invalidCredentials() {
    return new AuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password",
      401
    );
  }

  static accountNotFound() {
    return new AuthError("ACCOUNT_NOT_FOUND", "Account not found", 404);
  }

  static accountLocked() {
    return new AuthError("ACCOUNT_LOCKED", "Account has been locked", 403);
  }

  static emailNotVerified() {
    return new AuthError(
      "EMAIL_NOT_VERIFIED",
      "Email address not verified",
      403
    );
  }

  static emailTaken() {
    return new AuthError("EMAIL_TAKEN", "Email address already exists", 409);
  }

  static invalidToken() {
    return new AuthError("INVALID_TOKEN", "Invalid or expired token", 401);
  }

  static invalidSession() {
    return new AuthError("INVALID_SESSION", "Session is invalidated or expired", 401);
  }

  static sessionNotfound() {
    return new AuthError(
      "SESSION_NOT_FOUND",
      "Session not found",
      404
    );
  }

  static invalidOTP() {
    return new AuthError(
      "INVALID_OTP",
      "The verification code is invalid",
      400
    );
  }

  static otpNotFound() {
    return new AuthError(
      "OTP_NOT_FOUND",
      "OTP not found or has expired. Please request a new verification code for your email address.",
      404
    );
  }

  static tooManyAttempts(waitTime?: number) {
    return new AuthError(
      "TOO_MANY_ATTEMPTS",
      waitTime
        ? `Too many attempts. Please try again in ${getTimeDifference(
            waitTime
          )}`
        : "Too many attempts. Please try again later",
      429
    );
  }

  static maxSessionsExceeded() {
    return new AuthError(
      "MAX_SESSIONS_EXCEEDED",
      "Maximum number of active sessions exceeded",
      400
    );
  }

  static invalidRequest(message: string) {
    return new AuthError("INVALID_REQUEST", message, 400);
  }
}