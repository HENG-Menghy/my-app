// @/api/system-cleanup/route.ts

import { ApiResponse } from "@/lib/api/response";
import prisma from "@/lib/db/prisma";
import { Logger } from "@/lib/logger";
import { sessionService } from "@/services/sessionService";
import { AuthEventStatus, UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";

export async function POST(_: NextRequest) {
  const now = new Date();
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Revoke expired sessions
        const { count: sessionsRevoked } = await tx.session.updateMany({
          where: {
            expiresAt: { lte: now },
            revoked: false,
          },
          data: { revoked: true, revokedAt: new Date() },
        });

        // 2. Mark users inactive
        const users = await tx.user.findMany({
          where: {
            sessions: {
              none: {
                OR: [{ revoked: false }, { expiresAt: { gt: now } }],
              },
            },
            status: { not: "inactive" },
          },
          select: { id: true },
        });

        if (users.length) {
          await tx.user.updateMany({
            where: { id: { in: users.map((u) => u.id) } },
            data: { status: UserStatus.inactive },
          });
        }

        // 3. Fetch revoked sessions, then clear them from Redis
        const revokedSessions = await tx.session.findMany({
          where: { revoked: true },
          select: { id: true },
        });
        await sessionService.clearSessions(revokedSessions.map((s) => s.id));

        // 4. Purge stale audit logs
        const { count: staledAuditLogs } = await tx.authEvent.deleteMany({
          where: { status: AuthEventStatus.failure },
        });

        Logger.debug(
          "[QStash Schedules] System cleanup run every 30 minutes",
          {
            sessionsRevoked,
            usersStatusUpdated: users.length,
            staledAuditLogs,
            actor: "System",
          }
        );
      },
      { timeout: 30000 }
    );
    return ApiResponse.success({
      message: "[QStash Schedules] System cleanup completed successfully",
    });
  } catch (err) {
    Logger.error("QSTASH_SCHEDULES_ERROR", err as Error);
    return ApiResponse.error(err);
  }
}
