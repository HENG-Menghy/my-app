// @/api/floor/route.ts

import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { prisma } from "@/lib/prisma";
import { FloorSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/lib/validationError";
import { getRoomName } from "@/lib/generateRoomName";
import { getFloorLabel } from "@/lib/generateFloorLabel";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = FloorSchema.parse(body);
    const { buildingId, floorNumber, totalRooms } = data;

    // Check if building exists
    const existingBuilding = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true, totalRooms: true },
    });

    if (!existingBuilding) { 
      return NextResponse.json(
        { error: "Building does not exist" },
        { status: 400 }
      );
    }

    // Check if the floor already exists within the building
    const existingFloor = await prisma.floor.findFirst({
      where: { buildingId, floorNumber },
    });

    if (existingFloor) {
      return NextResponse.json(
        {
          error: `Floor ${floorNumber} already exists in this building`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the floor with an appropriate label
      const createdFloor = await tx.floor.create({
        data: { ...data, label: getFloorLabel(floorNumber) },
      });

      // If totalRooms is provided, create the default rooms
      if (totalRooms) {
        const defaultAvailableHours = {
          monday: [{ start: "08:00", end: "17:00" }],
          tuesday: [{ start: "08:00", end: "17:00" }],
          wednesday: [{ start: "08:00", end: "17:00" }],
          thursday: [{ start: "08:00", end: "17:00" }],
          friday: [{ start: "08:00", end: "17:00" }],
          saturday: [],
          sunday: [],
        };
        const defaultAmenities = ["projector", "whiteboard", "air-conditioned"];
        await tx.room.createMany({
          data: Array.from({ length: totalRooms }).map((_, i) => ({
            name: getRoomName(existingBuilding.name, floorNumber, i),
            floorId: createdFloor.id,
            type: "meeting",
            capacity: 10,
            amenities: defaultAmenities,
            availableHours: defaultAvailableHours,
            status: "active",
          })),
        });
      }

      // Update the building's total floors and total rooms count
      const [totalFloors, totalRoomsInBuilding] = await Promise.all([
        tx.floor.count({ where: { buildingId } }),
        tx.room.count({
          where: { floor: { buildingId } },
        }),
      ]);

      // Update the building record; if a new floor with number 0 is created, set hasGroundFloor to true
      await tx.building.update({
        where: { id: buildingId },
        data: {
          totalFloors,
          totalRooms: totalRoomsInBuilding,
          ...(floorNumber === 0 && { hasGroundFloor: true }),
        },
      });

      return createdFloor;
    });

    return NextResponse.json(
      {
        message: "Floor created successfully",
        floor: convertDatesToPhnomPenhTimezone(result),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return HandleZodError(error);
  }
}

/*
  GET /api/floor
  Retrieve all floors, ordering by building and floor number
*/
export async function GET(request: NextRequest) {
  try {
    const floors = await prisma.floor.findMany({
      orderBy: [
        { buildingId: "asc" },
        { floorNumber: "asc" },
      ],
    });
    return NextResponse.json(
      { floors: convertDatesToPhnomPenhTimezone(floors) },
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
  DELETE /api/floor
  Delete all floors that belong to a specified building,
  with a guard check to prevent deletion if any floor still has rooms
*/
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    // Validate buildingId format using Zod
    const buildingIdSchema = z.string().uuid();
    const parseResult = buildingIdSchema.safeParse(body.buildingId);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid building id format" },
        { status: 400 }
      );
    }
    const buildingId = parseResult.data;

    // Ensure the building exists
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) {
      return NextResponse.json(
        { error: "Building does not exist" },
        { status: 400 }
      );
    }

    // Verify that none of the floors in the building have rooms
    const floorsWithRooms = await prisma.floor.findMany({
      where: { buildingId },
      select: { id: true, rooms: true },
    });
    const hasRooms = floorsWithRooms.some((floor) => floor.rooms.length > 0);
    if (hasRooms) {
      return NextResponse.json(
        { error: "Cannot delete floors: some floors still have rooms" },
        { status: 400 }
      );
    }

    // Delete all floors for the building
    await prisma.floor.deleteMany({ where: { buildingId } });

    // Update building's totalFloors count after deletion
    const currentTotalFloors = await prisma.floor.count({
      where: { buildingId },
    });
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors: currentTotalFloors },
    });

    // Return the floors remaining for the building (should be empty)
    const remainingFloors = await prisma.floor.findMany({
      where: { buildingId },
    });
    return NextResponse.json(
      {
        message: `All floors belonging to building ${buildingId} were successfully deleted`,
        floors: convertDatesToPhnomPenhTimezone(remainingFloors),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting floors:", error);
    return NextResponse.json(
      { error: "Failed to delete floors" },
      { status: 500 }
    );
  }
}
