// @/api/building/deleteMany/route.ts

import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Define a schema for the request body
const deleteBuildingsSchema = z.object({
  id: z.array(z.string().uuid())
});

// Bulk delete buildings endpoint
export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate the body using zod
    const body = await request.json();
    const { id: buildingIds } = deleteBuildingsSchema.parse(body);

    if (buildingIds.length === 0) {
      return NextResponse.json(
        { error: "No building IDs provided" },
        { status: 400 }
      );
    }

    // Retrieve matched buildings
    const matchedBuildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { 
        id: true,
        floors: { select: { id: true } }
      }
    });

    // Ensure all provided IDs match existing buildings
    if (matchedBuildings.length !== buildingIds.length) {
      return NextResponse.json(
        { error: "Some building IDs do not exist" },
        { status: 400 }
      );
    }

    // Check if any of the buildings contain floors
    const hasFloors = matchedBuildings.some((b) => b.floors.length > 0);
    if (hasFloors) {
      return NextResponse.json(
        { error: "Some buildings contain floors: delete floors first" },
        { status: 400 }
      );
    }

    // Delete the buildings in one operation
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });

    // Fetch remaining buildings (or return a summary)
    const remainingBuildings = await prisma.building.findMany();
    
    return NextResponse.json(
      { 
        message: `${buildingIds.length} buildings were successfully deleted`,
        buildings: convertDatesToPhnomPenhTimezone(remainingBuildings)
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
