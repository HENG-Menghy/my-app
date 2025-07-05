// @/api/building/deleteMany/route.ts

import prisma from "@/lib/db/prisma";
import { HandleZodError } from "@/utils/validationError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Bulk-deleting buildings
export async function DELETE(request: NextRequest) {
  try {
    const validBuildingIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const buildingIds = validBuildingIds.parse(body);
    
    // Retrieve buildings, floors, and rooms including booking
    const buildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { id: true, name: true },
    });

    // Ensure all provided IDs match existing buildings
    if (buildings.length !== buildingIds.length) {
      return NextResponse.json(
        { error: "Some building IDs do not exist" },
        { status: 400 }
      );
    }

    // Delete buildings
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });

    return NextResponse.json(
      {
        success: true,
        message: `${buildingIds.length} buildings were successfully deleted`,
        deletedIds: buildingIds,
        deletedBuildings: buildings.map(b => b.name),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting buildings:", error);
    return HandleZodError(error);
  }
}