// @/services/tokenService.ts

import { JWT } from "@/lib/jwt";
import { Logger } from "@/lib/logger";
import type { AuthTokens } from "@/types/auth";
import { UserRole } from "@prisma/client";

class TokenService {
  async generateAuthTokens(payload: {
    uid: string;
    sid: string;
    email: string;
    role: UserRole;
  }): Promise<AuthTokens> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        JWT.signAccessToken(payload),
        JWT.signRefreshToken({
          uid: payload.uid,
          sid: payload.sid,
        }),
      ]);

      Logger.debug("GENERATE_TOKENPAIR_SUCCESSFULLY");

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      Logger.error("GENERATE_TOKENPAIR_ERROR", error as Error);
      throw error;
    }
  }
}

export const tokenService = new TokenService();
