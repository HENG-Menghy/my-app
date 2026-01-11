// @/api/session/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { sessionService } from "@/services/sessionService";
import { FormattedDateDisplay } from "@/utils/datetime";
import { Session, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();

    let sessions: Session[] = [];
    let message = "";
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    if (!type) {
      sessions = await prisma.session.findMany({
        orderBy: { createdAt: "desc" },
      });
      message = `Get all ${sessions.length} session(s)`;
    } else if (type === "active") {
      sessions = await prisma.session.findMany({
        where: { revoked: false },
        orderBy: { createdAt: "desc" },
      });
      message = `Get ${sessions.length} ‘active’ sessions(s)`;
    } else if (type === "revoked") {
      sessions = await prisma.session.findMany({
        where: { revoked: true },
        orderBy: { createdAt: "desc" },
      });
      message = `Get ${sessions.length} ‘revoked’ sessions(s)`;
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid type. Must be ‘active’ or ‘revoked’",
        },
        { status: 400 }
      );
    }

    return ApiResponse.success({
      message,
      data: FormattedDateDisplay(sessions),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin) {
      throw AuthError.forbidden();
    }

    const body = await request.json();
    const validIds = z.array(z.string().uuid()).nonempty();
    const ids = await validateRequest(validIds, body);
    const foundSessions = await prisma.session.findMany({
      where: { id: { in: ids } },
    });
    let message = "";
    let sessionIds: string[] = [];
    if (ids) {
      if (foundSessions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "None of provided session(s) found",
          },
          { status: 400 }
        );
      } else if (foundSessions.length !== ids.length) {
        return NextResponse.json(
          {
            success: false,
            message: "Some provided session(s) do not actually exist",
          },
          { status: 400 }
        );
      }
      sessionIds = [...ids];
      message = `Successfully terminated ${sessionIds.length} session(s)`;
    }
    await sessionService.terminateSessions(sessionIds);
    return ApiResponse.success({ message });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
