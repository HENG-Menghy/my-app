// @/api/building/deleteMany/route.ts

import { getAuthUser } from "@/lib/auth/auth";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { AuthError } from "@/lib/auth/errors";
import prisma from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Bulk-deleting buildings
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const validBuildingIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const buildingIds = await validateRequest(validBuildingIds, body);

    // Retrieve buildings
    const buildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { id: true, name: true },
    });
    if (buildingIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "None of provided building(s) found",
        },
        { status: 400 }
      )
    }

    // Ensure all provided IDs match existing buildings
    if (buildings.length !== buildingIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some provided building(s) do not actually exist",
        },
        { status: 400 }
      );
    }

    // Delete buildings
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });

    return ApiResponse.success({
      message: `${buildingIds.length} building(s) were deleted successfully`,
      data: {
        "deletedBuilding(s)": buildings.map((b) => ({
          id: b.id,
          name: b.name,
        })),
      },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
