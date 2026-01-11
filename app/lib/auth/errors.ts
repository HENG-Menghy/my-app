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

  static forbidden() {
    return new AuthError(
      "FORBIDDEN",
      "You don't have permission to access this resource.",
      403
    );
  }

  static unauthorized() {
    return new AuthError(
      "UNAUTHORIZED",
      "You are not authorized, please login.",
      401
    );
  }

  static invalidCredentials() {
    return new AuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
      400
    );
  }

  static accountNotFound() {
    return new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
  }

  static emailBlocked(waitTime?: number) {
    return new AuthError(
      "EMAIL_BLOCKED",
      waitTime
        ? `This email has been blocked from account registration for ${getTimeDifference(
            waitTime
          )}.`
        : "You cannot use this email to register at the moment. Please try again later.",
      403
    );
  }

  static emailTaken() {
    return new AuthError(
      "EMAIL_TAKEN",
      "Email address is already registered.",
      409
    );
  }

  static invalidToken() {
    return new AuthError("INVALID_TOKEN", "Token is invalid.", 401);
  }

  static invalidSession() {
    return new AuthError("INVALID_SESSION", "Session is invalid.", 401);
  }

  static sessionNotfound() {
    return new AuthError("SESSION_NOT_FOUND", "Session not found.", 404);
  }

  static invalidOTP() {
    return new AuthError(
      "INVALID_OTP",
      "The verification code is invalid.",
      400
    );
  }

  static otpNotFound() {
    return new AuthError(
      "OTP_NOT_FOUND",
      "OTP not found or has expired. Please request a new verification code.",
      404
    );
  }

  static tooManyAttempts(waitTime?: number) {
    return new AuthError(
      "TOO_MANY_ATTEMPTS",
      waitTime
        ? `Too many attempts. Please try again in ${getTimeDifference(
            waitTime
          )}.`
        : "Too many attempts. Please try again later.",
      429
    );
  }

  static invalidRequest(message: string) {
    return new AuthError("INVALID_REQUEST", message, 400);
  }
}
