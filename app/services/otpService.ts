// @/services/otpService.ts

import crypto from "crypto";
import { UpstashRedis } from "@/lib/upstash-redis";
import { AuthError } from "@/lib/auth/errors";
import { AUTH_CONSTANTS, REDIS_PREFIXES } from "@/lib/constants";
import type { OTPData } from "@/types/redis";
import { LocalToUTC, fromUTCToLocal } from "@/utils/datetime";
import { Logger } from "@/lib/logger";

class OTPService {
  async generateOTP(email: string, type: OTPData["type"]): Promise<string> {
    // Generate 6-digits code
    const otp = crypto.randomInt(100000, 999999).toString();
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    const localDateTime = fromUTCToLocal(
      new Date(Date.now() + AUTH_CONSTANTS.OTP_EXPIRY * 1000)
    ).toString();
    const otpData: OTPData = {
      email,
      type,
      code: otp,
      attempts: 0,
      verified: false,
      expiresAt: localDateTime,
    };
    await UpstashRedis.set(
      key,
      JSON.stringify(otpData),
      AUTH_CONSTANTS.OTP_EXPIRY
    );

    return otp;
  }

  async getOTPData(
    email: string,
    type: OTPData["type"]
  ): Promise<OTPData | null> {
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    const data = (await UpstashRedis.get(key)) as unknown as OTPData;
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
        "VERIFY_OTP_FAILED",
        new Error(
          "OTP not found or has expired. Please request a new verification code"
        )
      );

      throw AuthError.otpNotFound();
    }

    // Update attempts and expiration
    data.attempts += 1;
    const expiresTime = LocalToUTC(data.expiresAt);
    data.expiresAt = fromUTCToLocal(expiresTime).toString();
    if (data.code !== otp) {
      await UpstashRedis.set(
        key,
        JSON.stringify(data),
        Math.floor((expiresTime.getTime() - new Date().getTime()) / 1000)
      );

      throw AuthError.invalidOTP();
    }

    // OTP verified correctly within allowed time, set new expiration
    data.verified = true;
    data.expiresAt = fromUTCToLocal(
      new Date(Date.now() + AUTH_CONSTANTS.EMAIL_VERIFIED_EXPIRY * 1000)
    ).toString();
    await UpstashRedis.set(
      key,
      JSON.stringify(data),
      AUTH_CONSTANTS.EMAIL_VERIFIED_EXPIRY // Mark email as verified for 10 minutes
    );
  }

  async clearOTPData(email: string, type: OTPData["type"]): Promise<void> {
    const key = `${REDIS_PREFIXES.OTP}${type}:${email}`;
    await UpstashRedis.del(key);
  }
}

export const otpService = new OTPService();
