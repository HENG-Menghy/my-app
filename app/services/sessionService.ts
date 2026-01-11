// @/services/sessionService.ts

import prisma from "@/lib/db/prisma";
import { REDIS_PREFIXES } from "@/lib/constants";
import { UpstashRedis } from "@/lib/upstash-redis";
import { SessionWithAuthEvent } from "@/types/auth";
import {
  AuthEvent,
  AuthEventStatus,
  AuthEventType,
  Prisma,
  Session,
} from "@prisma/client";

class SessionService {
  async auditLog(
    userId: string | null,
    type: AuthEventType,
    status: AuthEventStatus,
    actor: string,
    reason: string | null
  ) {
    await prisma.authEvent.create({
      data: {
        userId,
        type,
        status,
        actor,
        reason,
      },
    });
  }

  async createSessionWithAuthEvent(
    data: SessionWithAuthEvent
  ): Promise<{ authEvent: AuthEvent; session: Session }> {
    return prisma.$transaction(
      async (tx) => {
        let authEvent = await tx.authEvent.findFirst({
          where: {
            userId: data.userId,
            type: data.type,
            status: data.status,
            actor: data.actor,
            reason: data.reason,
          },
        });

        if (!authEvent) {
          authEvent = await tx.authEvent.create({
            data: {
              userId: data.userId,
              type: data.type,
              status: data.status,
              actor: data.actor,
              reason: data.reason,
            },
          });
        }

        const session = await tx.session.create({
          data: {
            userId: data.userId,
            eventId: authEvent.id,
            revoked: data.revoked,
            revokedAt: data.revokedAt,
            expiresAt: data.expiresAt,
            metadata: data.metadata as unknown as Prisma.InputJsonValue,
          },
        });

        return { authEvent, session };
      },
      { timeout: 30000 }
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await Promise.all([
      prisma.session.update({
        where: { id: sessionId },
        data: { revoked: true, revokedAt: new Date() },
      }),
      this.clearSession(sessionId),
    ]);
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    await Promise.all([
      prisma.session.updateMany({
        where: { id: { in: sessionIds } },
        data: { revoked: true, revokedAt: new Date() },
      }),
      this.clearSessions(sessionIds),
    ]);
  }

  async revokeSessions(sessionIds: string[]): Promise<void> {
    await Promise.all([
      prisma.session.updateMany({
        where: { id: { in: sessionIds } },
        data: { revoked: true, revokedAt: new Date() },
      }),
      this.clearSessions(sessionIds),
    ]);
  }

  async terminateSession(sessionId: string): Promise<void> {
    await Promise.all([
      prisma.session.delete({ where: { id: sessionId } }),
      this.clearSession(sessionId),
    ]);
  }

  async terminateUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    await Promise.all([
      prisma.session.deleteMany({ where: { id: { in: sessionIds } } }),
      this.clearSessions(sessionIds),
    ]);
  }

  async terminateSessions(sessionIds: string[]): Promise<void> {
    await Promise.all([
      prisma.session.deleteMany({ where: { id: { in: sessionIds } } }),
      this.clearSessions(sessionIds),
    ]);
  }

  // Cache active (valid) session in Redis
  async cacheSession(session: Session): Promise<void> {
    if (!session.revoked && session.expiresAt! > new Date()) {
      const key = `${REDIS_PREFIXES.SESSION}${session.id}`;
      const value = JSON.stringify(session.metadata);

      await UpstashRedis.set(
        key,
        value,
        Math.floor(session.expiresAt!.getTime() / 1000) -
          Math.floor(Date.now() / 1000)
      );
    }
  }

  // Clear revoked session from Redis
  async clearSession(sessionId: string): Promise<void> {
    await UpstashRedis.del(`${REDIS_PREFIXES.SESSION}${sessionId}`);
  }

  // Clear revoked sessions from Redis
  async clearSessions(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      await this.clearSession(sessionId);
    }
  }
}

export const sessionService = new SessionService();
