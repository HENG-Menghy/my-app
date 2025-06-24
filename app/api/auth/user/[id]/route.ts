// @/api/auth/user/[id]

import { ApiResponse } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { FormattedDateDisplay } from "@/utils/datetime";
import { NextRequest } from "next/server";

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    throw new AuthError("MISSING_ID_PARAMS", "ID is reuired");
  }

  try {
    await prisma.user.delete({ where: { id } });
    return ApiResponse.success({
      message: `User has been deleted successfully
            [Deleted id]: [${id}]`,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    throw new AuthError("MISSING_ID_PARAMS", "ID is required");
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return new AuthError("USER_NOT_FOUND", "User not found", 404);
    }

    return ApiResponse.success({
      message: "Get user successfully",
      data: FormattedDateDisplay(user),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
