// @/services/otpService.ts

import crypto from "crypto";
import { RedisClient } from "@/lib/auth/redis";
import { AuthError } from "@/lib/auth/errors";
import { AUTH_CONSTANTS, REDIS_PREFIXES } from "@/lib/auth/constants";
import type { OTPData } from "@/types/redis";
import { fromUTCToLocal } from "@/utils/datetime";
import { Logger } from "@/lib/logger";

class OTPService {
  async generateOTP(email: string, type: OTPData["type"]): Promise<string> {
    // Generate 6-digits code
    const otp = crypto.randomInt(100000, 999999).toString();
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;

    const otpData: OTPData = {
      email,
      type,
      code: otp,
      attempts: 0,
      verified: false,
      expiresAt: fromUTCToLocal(
        new Date(Date.now() + AUTH_CONSTANTS.OTP_EXPIRY * 1000)
      ).toJSDate(),
    };

    await RedisClient.set(key, JSON.stringify(otpData), {
      ex: AUTH_CONSTANTS.OTP_EXPIRY,
    });

    return otp;
  }

  async getOTPData(
    email: string,
    type: OTPData["type"]
  ): Promise<OTPData | null> {
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    const data = await RedisClient.get(key);
    return data && typeof data === "string" ? JSON.parse(data) : data;
  }

  async verifyOTP(
    email: string,
    otp: string,
    type: OTPData["type"]
  ): Promise<void> {
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    const data = await this.getOTPData(email, type);

    if (!data) {
      Logger.error(
        "VERIFY_EMAIL_FAILED",
        new Error("The verification code does not exists for this email")
      );

      throw AuthError.otpNotFound();
    }

    // Update attempts
    data.attempts += 1;

    // Convert string back to DateTime
    data.expiresAt = fromUTCToLocal(data.expiresAt).toJSDate();

    if (data.code !== otp) {
      await RedisClient.set(key, JSON.stringify(data), {
        ex: Math.floor(
          (data.expiresAt.getTime() - new Date().getTime()) / 1000
        ),
      });

      throw AuthError.invalidOTP();
    }

    // OTP verified correctly within allowed time
    data.verified = true;
    data.expiresAt = fromUTCToLocal(
      new Date(Date.now() + AUTH_CONSTANTS.EMAIL_VERIFIED_EXPIRY * 1000)
    ).toJSDate();
    await RedisClient.set(
      key,
      JSON.stringify(data),
      { ex: AUTH_CONSTANTS.EMAIL_VERIFIED_EXPIRY } // Mark email as verified for 10 minutes
    );
  }

  async clearOTPData(email: string, type: OTPData["type"]): Promise<void> {
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    await RedisClient.del(key);
  }
}

export const otpService = new OTPService();
