// @/api/auth/profile/route.ts

import { getAuthUser } from "@/lib/auth/auth";
import { ApiResponse } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/errors";
import { authService } from "@/services/authService";
import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api/validate";
import { ProfileUpdateSchema } from "@/lib/validations/auth";
import { getSessionMetadata } from "@/lib/sessionMetadata";
import { UserRole } from "@prisma/client";
import { FormattedDateDisplay } from "@/utils/datetime";

export async function DELETE(request: NextRequest) {
  try {
    const metadata = await getSessionMetadata(request);
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    const { role, userId } = authUser;

    if (role === UserRole.admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin account cannot be deleted",
        },
        { status: 400 }
      );
    }
    
    await authService.deleteAccount(userId, metadata);

    return ApiResponse.success({
      message: "Your account has been successfully removed from the system",
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();

    const { userId } = authUser;
    const user = await authService.viewProfile(userId);

    return ApiResponse.success({ data: FormattedDateDisplay(user) });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) throw AuthError.unauthorized();
    const { userId } = authUser;
    
    const body = await request.json();
    const profileUpdateData = await validateRequest(ProfileUpdateSchema, body);
    const metadata = await getSessionMetadata(request);

    const user = await authService.updateProfile(
      userId,
      profileUpdateData,
      metadata
    );

    return ApiResponse.success({
      message: "Your profile information was updated successfully",
      data: FormattedDateDisplay(user),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
