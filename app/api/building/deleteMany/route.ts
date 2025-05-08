// @/api/building/deleteMany/route.ts

import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Delete buildings with bulk-deleting
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const buildingIds: string[] = body.id;
    if (
      !buildingIds ||
      !Array.isArray(buildingIds) ||
      buildingIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No building IDs provided" },
        { status: 400 }
      );
    }
    
    // Validate each id
    const idValidation = z.string().uuid();
    for (const id of buildingIds) {
      const result = idValidation.safeParse(id);
      if(!result.success) {
        return NextResponse.json( 
          { error: `Invalid building ID: ${id}`}, 
          { status: 400 }
        );
      }
    }

    // Get buildings that match with id in buildingIds
    const MatchedBuildings = await prisma.building.findMany({
      where: { id: { in: buildingIds } },
      select: { 
        id: true,
        floors: {
          select: { id: true }
        } 
      }
    });

    // Check if any id does not actually exist
    if(MatchedBuildings.length !== buildingIds.length) {
      return NextResponse.json(
        { error: "Some building IDs do not exist" }, 
        { status: 400 }
      );
    }

    // Check if some building still have floors
    const hasFloors = MatchedBuildings.some(b => b.floors.length > 0);
    if(hasFloors) {
      return NextResponse.json(
        { error: 'Some buildings cantain floors: delete floors first' },
        { status: 400 }
      );
    }

    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });
    const buildings = await prisma.building.findMany();
    return NextResponse.json(
      { 
        message: `${buildingIds.length} buildings was successfully deleted`,
        building: convertDatesToPhnomPenhTimezone(buildings)
      },
      { status: 200 }
    );

  } catch (error) {
    console.log("Error deleting buildings: ", error);
    return NextResponse.json(
      { error: "Failed to delete buildings" },
      { status: 500 }
    );
  }
}
