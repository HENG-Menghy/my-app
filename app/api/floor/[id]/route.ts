// @/api/floor/[id]/route.ts

import { prisma } from "@/lib/prisma";
import { FloorUpdateSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/app/lib/validationError";
import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";

// Update floor
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const body = await request.json();
    const data = FloorUpdateSchema.parse(body);
    const { floorNumber, totalRooms, name } = data;
    const floor = await prisma.floor.findUnique({ where: { id } });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    // If the floor number is changing, ensure there isn’t a duplicate in the same building
    if (typeof floorNumber === "number") {
      const existingFloor = await prisma.floor.findFirst({
        where: { buildingId: floor.buildingId, floorNumber },
      });

      if (existingFloor) {
        return NextResponse.json(
          { error: `Error updating floor: floor number ${floorNumber} already exists in this building` },
          { status: 400 }
        );
      }
    }

    if (typeof name === "string") {
      const existingName = await prisma.floor.findFirst({
        where: { buildingId: floor.buildingId, name },
      });

      if (existingName) {
        return NextResponse.json(
          { error: `Error updating floor: This name ${name} already exists in this building` },
          { status: 400 }
        );
      }
    }

    const updatedFloor = await prisma.floor.update({ where: { id }, data });

    //
    // const defaultAvailableHours = {
    //   monday: [{ start: "08:00", end: "17:00" }],
    //   tuesday: [{ start: "08:00", end: "17:00" }],
    //   wednesday: [{ start: "08:00", end: "17:00" }],
    //   thursday: [{ start: "08:00", end: "17:00" }],
    //   friday: [{ start: "08:00", end: "17:00" }],
    //   saturday: [],
    //   sunday: [],
    // };
    // const defaultAmenities = ["projector", "whiteboard", "air-conditioned"];
    // const roomData = Array.from({ length: totalRooms }).map((_, i) => ({
    //   name: `Room ${i + 1}`,
    //   floorId: id,
    //   type: "meeting",
    //   capacity: 10,
    //   amenities: defaultAmenities,
    //   availableHours: defaultAvailableHours,
    //   status: "active",
    // }));
    // await prisma.$transaction(
    //   roomData.map(data => prisma.room.create({ data }))
    // );

    // Return success response with the updated floor (with dates converted to Phnom Penh timezone)
    return NextResponse.json(
      {
        message: "Floor updated successfully",
        floor: convertDatesToPhnomPenhTimezone(updatedFloor),
      },
      { status: 201 }
    );
  } catch (error) {
    return HandleZodError(error);
  }
}

// Get floor by id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const floor = await prisma.floor.findUnique({
      where: { id },
      include: {
        rooms: {
          select: {
            id: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    return NextResponse.json(
      { floor: convertDatesToPhnomPenhTimezone(floor) },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error fetching floor: ", error);
    return NextResponse.json(
      { error: "Failed to retrieve floor" },
      { status: 500 }
    );
  }
}

// Delete floor by id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const floor = await prisma.floor.findUnique({ 
      where: { id }, 
      select: { rooms: true, buildingId: true } 
    });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 400 });
    }

    // Check if floor contain rooms
    if (floor.rooms.length > 0) {
      return NextResponse.json(
        { error: "Cannot deleteThis floor contain rooms" },
        { status: 400 }
      );
    }

    await prisma.floor.delete({ where: { id } });

    // Update totalFloors in building after floor has been deleted
    const totalFloors = await prisma.floor.count({
      where: { buildingId: floor.buildingId },
    });
    await prisma.building.update({
      where: { id: floor.buildingId },
      data: { totalFloors },
    });
    const floors = await prisma.floor.findMany();
    return NextResponse.json(
      {
        message: "Floor deleted successfully",
        floor: convertDatesToPhnomPenhTimezone(floors),
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error deleting building: ", error);
    return NextResponse.json(
      { error: "Failed to delete floor" },
      { status: 500 }
    );
  }
}
