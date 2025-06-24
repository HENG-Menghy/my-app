// @/api/building/route.ts

import prisma from "@/lib/db/prisma";
import { BuildingSchema } from "@/lib/validations/building";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay } from "@/utils/datetime";
import { HandleZodError } from "@/utils/validationError";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { normalizeName } from "@/utils/normalizeName";

// Create building with auto-generated floors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = BuildingSchema.parse(body);
    const { name, totalFloors, hasGroundFloor, address } = data;

    // Helper function to clean and format text (trim & remove extra spaces)
    const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();

    // Normalize building name and address
    const titleCaseName = normalizeName(name);
    const cleanAddress = cleanText(address);

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
        data: { ...data, name: titleCaseName, address: cleanAddress },
      });

      // Determine the starting floor number
      const startingFloor = hasGroundFloor ? 0 : 1;
      const totalFloorCount = hasGroundFloor ? totalFloors + 1 : totalFloors;

      // Auto-generate floor data based on the total number of floors
      const floorData = Array.from({ length: totalFloorCount }).map((_, i) => ({
        buildingId: building.id,
        floorNumber: startingFloor + i,
        label: getFloorLabel(startingFloor + i),
      }));

      // Create floors for the building
      await tx.floor.createMany({ data: floorData });
      return building;
    });

    return NextResponse.json(
      {
        message: "Building was successfully created",
        building: FormattedDateDisplay(buildingWithFloors),
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
    return NextResponse.json(FormattedDateDisplay(buildings), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching buildings:", error);
    return NextResponse.json(
      { error: "Failed to retrieve buildings" },
      { status: 500 }
    );
  }
}

// Delete all buildings
export async function DELETE(_: NextRequest) {
  try {
    // Delete all buildings
    await prisma.building.deleteMany();

    const buildings = await prisma.building.findMany();

    return NextResponse.json(
      { message: "All buildings were successfully deleted", buildings },
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
