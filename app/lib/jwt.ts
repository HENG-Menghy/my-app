// @/lib/jwt.ts

import jwt from "jsonwebtoken";
import { AuthError } from "./auth/errors";
import { Logger } from "./logger";
import { AUTH_CONSTANTS } from "./constants";
import { AccessTokenPayload, RefreshTokenPayload } from "@/types/auth";

// JWT secrets
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export class JWT {
  static signAccessToken(payload: AccessTokenPayload): string {
    try {
      return jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY,
      });
    } catch (error) {
      Logger.error("ACCESS_TOKEN_SIGN_ERROR", error as Error);
      throw new AuthError("TOKEN_SIGN_ERROR", "Failed to create access token");
    }
  }

  static signRefreshToken(payload: RefreshTokenPayload): string {
    try {
      return jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY,
      });
    } catch (error) {
      Logger.error("REFRESH_TOKEN_SIGN_ERROR", error as Error);
      throw new AuthError("TOKEN_SIGN_ERROR", "Failed to create refresh token");
    }
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        Logger.error("ACCESS_TOKEN_EXPIRED", error as Error);
        throw new AuthError("TOKEN_EXPIRED", "Access token has expired", 401);
      }
      Logger.error("ACCESS_TOKEN_INVALID", error as Error);
      throw AuthError.invalidToken();
    }
  }

  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        Logger.error("REFRESH_TOKEN_EXPIRED", error as Error);
        throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired", 401);
      }
      Logger.error("REFRESH_TOKEN_INVALID", error as Error);
      throw AuthError.invalidToken();
    }
  }
}
