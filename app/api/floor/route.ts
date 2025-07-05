// @/api/floor/route.ts

import prisma from "@/lib/db/prisma";
import { FormattedDateDisplay } from "@/utils/datetime";
import { FloorSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/utils/validationError";
import { getRoomName } from "@/utils/generateRoomName";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { z } from "zod";
import { normalizeName } from "@/utils/normalizeName";

// CREATE new floor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = FloorSchema.parse(body);
    const { 
      buildingId, 
      name, 
      floorNumber, 
      totalRooms,
      RoomsCapacities,
      RoomsAmenities,
      RoomsAvailableHours,
    } = data;

    // Check if building exists
    const existingBuilding = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true, totalRooms: true, hasGroundFloor: true },
    });

    if (!existingBuilding) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    // Check if the floor number already exists within the building
    const existingFloor = await prisma.floor.findFirst({
      where: { buildingId, floorNumber },
    });

    if (existingFloor) {
      return NextResponse.json(
        { error: `Floor ${floorNumber} already exists in this building` },
        { status: 400 }
      );
    }

    // Check for existing floor name conflict
    if (name && name.trim() !== "") {
      const cleanName = normalizeName(name);
      const existingName = await prisma.floor.findFirst({
        where: {
          name: {
            equals: cleanName,
            mode: "insensitive",
          },
        },
      });

      if (existingName) {
        return NextResponse.json(
          { error: `Floor name '${name.trim()}' already exists` },
          { status: 400 }
        );
      }
      data.name = cleanName;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the floor with an appropriate label
      const createdFloor = await tx.floor.create({
        data: {
          buildingId,
          name,
          floorNumber,
          totalRooms,
          label: getFloorLabel(floorNumber) 
        },
      });

      for (let i = 0; i < totalRooms; i++) {
        const roomName = getRoomName(existingBuilding.name, floorNumber, i);

        // Create rooms one-by-one so we can use returned room IDs
        await tx.room.create({
          data: {
            name: roomName,
            floorId: createdFloor.id,
            capacity: RoomsCapacities ?? defaultRoomValues.capacities,
            amenities: RoomsAmenities ?? defaultRoomValues.amenities,
            availableHours: RoomsAvailableHours ?? defaultRoomValues.available_hours,
          },
        });
      };

      // Get all floors for the building (their IDs and floorNumbers)
      const floors = await tx.floor.findMany({
        where: { buildingId },
        select: { id: true },
      });
      const floorIds = floors.map((f) => f.id);

      // Count all rooms on these floors.
      const roomCount = await tx.room.count({
        where: { floorId: { in: floorIds } },
      });

      // Update the building record
      // totalFloors represents only numbered floors (e.g. floors 1 to n).
      const floorCount = floors.length;
      const newTotalFloors =
        existingBuilding.hasGroundFloor || floorNumber === 0
          ? floorCount - 1
          : floorCount;
      await tx.building.update({
        where: { id: buildingId },
        data: {
          totalFloors: newTotalFloors,
          totalRooms: roomCount,
          ...(floorNumber === 0 && { hasGroundFloor: true }),
        },
      });

      return createdFloor;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Floor created successfully",
        floor: FormattedDateDisplay(result),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.log("Create floor error: ", error);
    return HandleZodError(error);
  }
}

/*
  GET all floors
  Retrieve all floors, ordering by building and floor number
*/
export async function GET(_: NextRequest) {
  try {
    const floors = await prisma.floor.findMany({
      orderBy: [{ buildingId: "asc" }, { floorNumber: "asc" }],
    });
    return NextResponse.json(
      {
        success: true,
        AllFloors: FormattedDateDisplay(floors),
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching floors:", error);
    return NextResponse.json(
      { error: "Failed to fetch floors" },
      { status: 500 }
    );
  }
}

/*
  DELETE all floors belong to building
*/
export async function DELETE(request: NextRequest) {
  try {
    const validBuildingId = z.string().uuid();
    const body = await request.json();
    const buildingId = validBuildingId.parse(body);

    // Ensure the building exists.
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    // Delete all floors for the building
    await prisma.floor.deleteMany({
      where: { buildingId },
    });

    // After deletion, update the building's totals.
    // Now there should be no floors, so totalFloors = 0; and similarly, no rooms exist.
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors: 0, totalRooms: 0, hasGroundFloor: false },
    });

    // Return the remaining floors (should be an empty list)
    const remainingFloors = await prisma.floor.findMany({
      where: { buildingId },
    });

    return NextResponse.json(
      {
        success: true,
        message: `All floors belonging to building ${building.name} were successfully deleted.`,
        remainingFloors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting floors:", error);
    return HandleZodError(error);
  }
}