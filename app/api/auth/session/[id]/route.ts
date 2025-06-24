// @/api/auth/session/[id]/route.ts

import { ApiResponse } from "@/lib/api/response";
import { REDIS_PREFIXES } from "@/lib/auth/constants";
import { AuthError } from "@/lib/auth/errors";
import { RedisClient } from "@/lib/auth/redis";
import prisma from "@/lib/db/prisma";
import { sessionService } from "@/services/sessionService";
import { FormattedDateDisplay } from "@/utils/datetime";
import { NextRequest } from "next/server";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const session = await sessionService.getSessionInfo(id);
    if (!session) {
        throw AuthError.sessionNotfound()
    }

    return ApiResponse.success({
        message: `Successfully get session by id - [${id}]`,
        data: FormattedDateDisplay(session)
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
        throw AuthError.sessionNotfound()
    }

    await Promise.all([
      prisma.session.delete({ where: { id } }),
      RedisClient.del(`${REDIS_PREFIXES.SESSION}${id}`),
    ]);

    return ApiResponse.success({
      message: `Successfully deleted session
            [Deleted id: ${id}]
            `,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
