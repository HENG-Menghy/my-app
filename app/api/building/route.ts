// @/api/building/route.ts

import prisma from "@/lib/db/prisma";
import { BuildingSchema } from "@/lib/validations/building";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay } from "@/utils/datetime";
import { HandleZodError } from "@/utils/validationError";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { normalizeName } from "@/utils/normalizeName";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { getRoomName } from "@/utils/generateRoomName";

// Create building
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = BuildingSchema.parse(body);
    const {
      name,
      address,
      totalFloors,
      totalRoomsOnEachFloor,
      hasGroundFloor,
      description,
      RoomsCapacities,
      RoomsAmenities,
      RoomsAvailableHours,
    } = data;

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

    const building = await prisma.$transaction(async (tx) => {
      // Create building
      const building = await tx.building.create({
        data: {
          name: titleCaseName,
          address: cleanAddress,
          totalFloors,
          hasGroundFloor,
          description,
        },
      });

      // Determine the starting floor number
      const startingFloor = hasGroundFloor ? 0 : 1;
      const totalFloorCount = hasGroundFloor ? totalFloors + 1 : totalFloors;

      // Auto-generate floor data based on the total number of floors
      const floorData = Array.from({ length: totalFloorCount }).map((_, i) => ({
        buildingId: building.id,
        floorNumber: startingFloor + i,
        totalRooms: totalRoomsOnEachFloor,
        label: getFloorLabel(startingFloor + i),
      }));

      // Create floors for the building
      await tx.floor.createMany({ data: floorData });
      const createdFloors = await tx.floor.findMany({
        where: { buildingId: building.id },
      });
      // Update totalRooms for building
      await tx.building.update({
        where: { id: building.id },
        data: { totalRooms: createdFloors.length * totalRoomsOnEachFloor },
      });

      // Auto-generate rooms
      await Promise.all(
        createdFloors.flatMap((floor) =>
          Array.from({ length: totalRoomsOnEachFloor }).map((_, i) =>
            tx.room.create({
              data: {
                floorId: floor.id,
                name: getRoomName(building.name, floor.floorNumber, i),
                capacity: RoomsCapacities ?? defaultRoomValues.capacities,
                amenities: RoomsAmenities ?? defaultRoomValues.amenities,
                availableHours:
                  RoomsAvailableHours ?? defaultRoomValues.available_hours,
              },
            })
          )
        )
      );

      // Re-fetch building with updated totalRooms
      const updateBuilding = await tx.building.findUnique({
        where: { id: building.id },
      });

      return updateBuilding;
    });

    return NextResponse.json(
      {
        message: "Building was successfully created",
        building: FormattedDateDisplay(building),
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
      {
        success: true,
        AllBuildings: FormattedDateDisplay(buildings),
      }, 
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

// Delete all buildings
export async function DELETE(_: NextRequest) {
  try {
    // Delete all buildings
    await prisma.building.deleteMany();
    const buildings = await prisma.building.findMany();
    return NextResponse.json(
      { 
        success: true,
        message: "All buildings were successfully deleted",
        buildings 
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