// @/api/building/deleteMany/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Bulk-deleting buildings
export async function DELETE(request: NextRequest) {
  try {
    const validBuildingIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const buildingIds = await validateRequest(validBuildingIds, body);
    
    // Retrieve buildings
    const buildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { id: true, name: true },
    });

    // Ensure all provided IDs match existing buildings
    if (buildings.length !== buildingIds.length) {
      return NextResponse.json(
        { 
          success: false,
          message: "Some building ID(s) do not exist" 
        },
        { status: 400 }
      );
    }

    // Delete buildings
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });

    return ApiResponse.success(
      {
        message: `${buildingIds.length} building(s) were successfully deleted`,
        data: {
          "deletedId(s)": buildingIds,
          "deletedBuilding(s)": buildings.map(b => b.name),
        },
      },
    );
  } catch (error) {
    console.error("Error deleting buildings:", error);
    return ApiResponse.error(error);
  }
}