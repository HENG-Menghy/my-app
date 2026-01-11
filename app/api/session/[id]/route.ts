// @/api/session/[id]/route.ts

import { ApiResponse } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { sessionService } from "@/services/sessionService";
import { FormattedDateDisplay } from "@/utils/datetime";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/auth";

export async function GET(
  request: NextRequest,
  { params } : { params : Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();

    const { id } = await params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) throw AuthError.sessionNotfound();

    return ApiResponse.success({
      data: FormattedDateDisplay(session),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params } : { params : Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    
    const { id } = await params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) throw AuthError.sessionNotfound();

    await sessionService.terminateSession(id);

    return ApiResponse.success({
      message: `Successfully deleted session
            [Deleted id: ${id}]
            `,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
