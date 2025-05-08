// @/api/building/route.ts

import { BuildingSchema } from "@/lib/validations/building";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { HandleZodError } from "@/lib/validationError";
import { getFloorLabel } from "@/lib/generateFloorLabel";
import { toTitleCase } from "@/lib/toTitleCase";

// Create building with auto-generate floor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = BuildingSchema.parse(body);
    const { name, totalFloors, hasGroundFloor } = data;
    const titleCaseName = toTitleCase(name);
    
    // Check for duplicate building name
    const existingName = await prisma.building.findFirst({ 
      where: { 
        name: {
          equals: titleCaseName,
          mode: 'insensitive'
        }
      } 
    });

    if(existingName) {
      return NextResponse.json({ error: `Cannot create building with name '${titleCaseName}': It already exists` }, { status: 400 });
    }

    const buildingWithFloors = await prisma.$transaction(async (tx) => {
      const building = await tx.building.create({ data: { ...data, name: titleCaseName } });
      const startingFloor = hasGroundFloor ? 0 : 1;
      const floorData = Array.from({ length: totalFloors }).map((_, i) => {
        const floorNumber = startingFloor + i;
        return {
          buildingId: building.id,
          floorNumber,
          label: getFloorLabel(floorNumber),
        };
      });
      await tx.floor.createMany({ data: floorData });
    
      return building;
    });
    
    return NextResponse.json(
      {
        message: "Building was successfully created", 
        building: convertDatesToPhnomPenhTimezone(buildingWithFloors),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Create building failed:", error);
    return HandleZodError(error);
  }
}

// Get all buildings
export async function GET() {
  try {
    const buildings = await prisma.building.findMany({ orderBy: { name: 'asc'} });
    return NextResponse.json({ building: convertDatesToPhnomPenhTimezone(buildings) }, { status: 200 });
  } catch (error) {
    console.error("Error fetching buildings:", error);
    return NextResponse.json({ error: "Failed to retrieve buildings" }, { status: 500 });
  }
}

// Delete all buildings with guard check
export async function DELETE(request: NextRequest) {
  try {
    const buildingWithFloors = await prisma.building.findMany({
      select: { 
        id: true,
        floors: { select: { id: true } } 
      }
    });

    // Check if any building contains floors
    const hasFloors = buildingWithFloors.some(building => building.floors.length);
    if(hasFloors) return NextResponse.json({ error: 'Cannot delete buildings: some buildings contain floors' }, { status: 400 });
    
    await prisma.building.deleteMany();
    const buildings = await prisma.building.findMany();

    return NextResponse.json( 
      { 
        message: 'All buildings was successfully deleted' ,
        building: convertDatesToPhnomPenhTimezone(buildings)
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.log("Error deleting buildings: ", error);
    return NextResponse.json({ error: 'Failed to delete buildings'}, { status: 500 });
  }
}