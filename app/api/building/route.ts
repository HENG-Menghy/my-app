// @/api/building/route.ts

import { BuildingSchema } from "@/lib/validations/building";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { HandleZodError } from "@/lib/validationError";
import { getFloorLabel } from "@/lib/generateFloorLabel";
import { toTitleCase } from "@/app/lib/getTitleCase";

// Create building with auto-generated floors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = BuildingSchema.parse(body);
    const { name, totalFloors, hasGroundFloor } = data;
    const titleCaseName = toTitleCase(name);

    // Check for duplicate building name (case-insensitive)
    const existingName = await prisma.building.findFirst({
      where: {
        name: {
          equals: titleCaseName,
          mode: "insensitive",
        },
      },
    });

    if (existingName) {
      return NextResponse.json(
        {
          error: `Cannot create building with name '${titleCaseName}': It already exists`,
        },
        { status: 400 }
      );
    }

    const buildingWithFloors = await prisma.$transaction(async (tx) => {
      // Create building
      const building = await tx.building.create({
        data: { ...data, name: titleCaseName },
      });

      // Determine the starting floor number
      const startingFloor = hasGroundFloor ? 0 : 1;

      // Auto-generate floor data based on the total number of floors
      const floorData = Array.from({ length: totalFloors }).map((_, i) => {
        const floorNumber = startingFloor + i;
        return {
          buildingId: building.id,
          floorNumber,
          label: getFloorLabel(floorNumber),
        };
      });

      // Create floors for the building
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
    const buildings = await prisma.building.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      { buildings: convertDatesToPhnomPenhTimezone(buildings) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching buildings:", error);
    return NextResponse.json(
      { error: "Failed to retrieve buildings" },
      { status: 500 }
    );
  }
}

// Delete all buildings with a guard check to ensure no floors exist
export async function DELETE(request: NextRequest) {
  try {
    const buildingWithFloors = await prisma.building.findMany({
      select: {
        id: true,
        floors: { select: { id: true } },
      },
    });

    // If any building contains floors, abort the deletion.
    const hasFloors = buildingWithFloors.some(
      (building) => building.floors.length > 0
    );
    if (hasFloors) {
      return NextResponse.json(
        { error: "Cannot delete buildings: some buildings contain floors" },
        { status: 400 }
      );
    }

    // Proceed to delete all buildings.
    await prisma.building.deleteMany();

    return NextResponse.json(
      { message: "All buildings were successfully deleted", buildings: [] },
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
