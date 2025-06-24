// @/api/building/deleteMany/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Define a schema for the request body
const deleteBuildingsSchema = z.object({
  id: z.array(z.string().uuid()),
});

// Bulk-deleting buildings
export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const { id: buildingIds } = deleteBuildingsSchema.parse(body);

    if (buildingIds.length === 0) {
      return NextResponse.json(
        { error: "No building IDs provided" },
        { status: 400 }
      );
    }

    // Retrieve buildings, floors, and rooms including booking
    const buildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { id: true },
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
        message: `${buildingIds.length} buildings were successfully deleted`,
        deletedIds: buildingIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting buildings:", error);
    return NextResponse.json(
      { error: "Failed to delete buildings" },
      { status: 500 }
    );
  }
}
