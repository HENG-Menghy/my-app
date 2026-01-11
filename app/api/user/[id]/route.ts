// @/api/user/[id]/route.ts

import { getAuthUser } from "@/lib/auth/auth";
import { ApiResponse } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw AuthError.accountNotFound();

    if (user.role === UserRole.admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin account cannot be deleted",
        },
        { status: 400 }
      );
    }

    // Delete user
    await prisma.user.delete({ where: { id } });

    return ApiResponse.success({
      message: `User account ‘${user.email}’ has been removed successfully`,
      data: { deletedAccount: user },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
