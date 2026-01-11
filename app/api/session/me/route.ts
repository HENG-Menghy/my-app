// @/api/session/me/route.ts

import { ApiResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { sessionService } from "@/services/sessionService";
import { FormattedDateDisplay } from "@/utils/datetime";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    const { userId } = authUser;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AuthError.accountNotFound();
    const sessions = await prisma.session.findMany({ where: { userId } });

    return ApiResponse.success({ data: FormattedDateDisplay(sessions) });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    const { userId } = authUser;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AuthError.accountNotFound();
    const sessions = await prisma.session.findMany({ where: { userId } });

    await sessionService.terminateUserSessions(userId);

    return ApiResponse.success({
      message: `Successfully terminated ${sessions.length} session(s)`,
      data: { "terminatedSession(s)": sessions.map((s) => s.id) },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
