// @/api/user/route.ts

import { getAuthUser } from "@/lib/auth/auth";
import { ApiResponse } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { FormattedDateDisplay } from "@/utils/datetime";
import { UserGender, UserRole, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import { validateRequest } from "@/lib/api/validate";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();

    // Get users by sort, search, filter
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const role = searchParams.get("role");
    const gender = searchParams.get("gender");
    const status = searchParams.get("status");
    const order = searchParams.get("order") === "desc" ? "desc" : "asc";
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { fullname: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phonenumber: { contains: search, mode: "insensitive" } },
            ],
          },
          ...(role ? [{ role: role as UserRole }] : []),
          ...(gender ? [{ gender: gender as UserGender }] : []),
          ...(status ? [{ status: status as UserStatus }] : []),
        ],
      },
      orderBy: { fullname: order },
    });
    return ApiResponse.success({
      message: "Get all users successfully",
      data: FormattedDateDisplay(users),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();

    const validIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const Ids: string[] = await validateRequest(validIds, body);
    const foundUsers = await prisma.user.findMany({
      where: { id: { in: Ids } },
      select: { id: true, email: true, role: true },
    });
    if (foundUsers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "None of provided users found",
        },
        { status: 400 }
      );
    }
    if (Ids.length !== foundUsers.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some provided users do not actually exist",
        },
        { status: 400 }
      );
    }
    const users = foundUsers.filter((user) => user.role !== UserRole.admin);
    await prisma.user.deleteMany({
      where: { id: { in: users.map((user) => user.id) } },
    });
    return ApiResponse.success({
      message: `${users.length} user(s) were removed successfully`,
      data: { deletedUsers: users },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
