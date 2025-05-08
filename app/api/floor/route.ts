// @/api/floor/route.ts

import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { prisma } from "@/lib/prisma";
import { FloorSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/lib/validationError";
import { z } from "zod";

// Create floor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = FloorSchema.parse(body);
    const { buildingId, floorNumber, totalRooms } = data;

    // Check if building exist
    const existingBuilding = await prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!existingBuilding) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    // Check if floorNumber already exists in the building
    const existingFloor = await prisma.floor.findFirst({
      where: {
        buildingId,
        floorNumber,
      },
    });

    if (existingFloor) {
      return NextResponse.json(
        { error: `Floor ${floorNumber} already exists in this building` },
        { status: 400 }
      );
    }

    // Create the floor
    const floor = await prisma.floor.create({ data });

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
      await prisma.room.createMany({
        data: Array.from({ length: totalRooms }).map((_, i) => ({
          name: `Room ${i + 1}`,
          floorId: floor.id,
          type: "meeting",
          capacity: 10,
          amenities: defaultAmenities,
          availableHours: defaultAvailableHours,
          status: "active"
        })),
      });
    }

    // update totalFloors in building after new floor created
    const totalFloors = await prisma.floor.count({ where: { buildingId } });
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors },
    });

    return NextResponse.json(
      {
        message: "Floor created successfully",
        floor: convertDatesToPhnomPenhTimezone(floor),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return HandleZodError(error);
  }
}

// Get all floors
export async function GET(request: NextRequest) {
  try {
    const floors = await prisma.floor.findMany({
      orderBy: [{ buildingId: "asc" }, { floorNumber: "asc" }],
    });
    return NextResponse.json(
      { floor: convertDatesToPhnomPenhTimezone(floors) },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error fetching floors: ", error);
    return NextResponse.json(
      { error: "Failed to fetch floors" },
      { status: 500 }
    );
  }
}

// Delete all floors belong to unique building with guard check
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const idValidation = z.string().uuid();
    const result = idValidation.safeParse(body.buildingId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid building id format" },
        { status: 400 }
      );
    }

    const buildingId = result.data;
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      return NextResponse.json(
        { error: "Building not found with this id" },
        { status: 400 }
      );
    }

    const floorsWithRooms = await prisma.floor.findMany({
      where: { buildingId },
      select: {
        id: true,
        rooms: true,
      },
    });

    const hasRooms = floorsWithRooms.some((floor) => floor.rooms.length);
    if (hasRooms) {
      return NextResponse.json(
        { error: "Cannot delete floors: some floors still have rooms" },
        { status: 400 }
      );
    }

    // perform deleting
    await prisma.floor.deleteMany({ where: { buildingId } });

    // update totalFloors in building after all floors deleted
    const currentTotalFloors = await prisma.floor.count({
      where: { buildingId },
    });
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors: currentTotalFloors },
    });

    const floors = await prisma.floor.findMany();
    return NextResponse.json(
      {
        message: `All floors belonging to building ${buildingId} was successfully deleted`,
        floor: convertDatesToPhnomPenhTimezone(floors),
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error deleting floors: ", error);
    return NextResponse.json(
      { error: "Failed to delete all floors" },
      { status: 500 }
    );
  }
}
