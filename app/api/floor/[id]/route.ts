// @/api/floor/[id]/route.ts

import { prisma } from "@/lib/prisma";
import { FloorUpdateSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/lib/validationError";
import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { getRoomName } from "@/lib/generateRoomName";
import { getFloorLabel } from "@/lib/generateFloorLabel";

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
    const floor = await prisma.floor.findUnique({
      where: { id },
      select: { buildingId: true, floorNumber: true },
    });

    if (!floor)
      return NextResponse.json(
        { error: "Floor does not exist" },
        { status: 400 }
      );

    // Check for floorNumber conflicts
    if (typeof floorNumber === "number") {
      const existingFloor = await prisma.floor.findFirst({
        where: { buildingId: floor.buildingId, floorNumber },
      });
      if (existingFloor) {
        return NextResponse.json(
          {
            error: `Error updating floor: floor ${floorNumber} already exist in this building`,
          },
          { status: 400 }
        );
      }
    }

    // Check for name conflicts
    if (typeof name === "string") {
      const existingName = await prisma.floor.findFirst({
        where: { name, NOT: { id } },
      });
      if (existingName) {
        return NextResponse.json(
          { error: `Error updating floor: The name '${name}' already exists` },
          { status: 400 }
        );
      }
    }

    // Handle room regeneration if totalRooms is provided
    if (typeof totalRooms === "number") {
      const rooms = await prisma.room.findMany({
        where: { floorId: id },
        select: { id: true, bookings: { select: { id: true } } },
      });

      const haveBooking = rooms.some((room) => room.bookings.length > 0);
      if (haveBooking)
        return NextResponse.json(
          { error: "Cannot adjust rooms: some rooms contain bookings" },
          { status: 400 }
        );

      // Delete old rooms
      await prisma.room.deleteMany({ where: { floorId: id } });

      // Get building name for room naming
      const building = await prisma.building.findUnique({
        where: { id: floor.buildingId },
        select: { name: true },
      });

      const newFloorNumber =
        typeof floorNumber === "number" ? floorNumber : floor.floorNumber;

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

      const roomData = Array.from({ length: totalRooms }).map((_, i) => ({
        name: getRoomName(building!.name, newFloorNumber, i),
        floorId: id,
        type: "meeting",
        capacity: 10,
        amenities: defaultAmenities,
        availableHours: defaultAvailableHours,
        status: "active",
      }));

      await prisma.$transaction(
        roomData.map((data) => prisma.room.create({ data }))
      );

      // Update totalRooms in building
      const totalRoomsInBuilding = await prisma.room.count({
        where: {
          floor: {
            buildingId: floor.buildingId,
          },
        },
      });

      await prisma.building.update({
        where: { id: floor.buildingId },
        data: { totalRooms: totalRoomsInBuilding },
      });

      // Prepare update data. If floorNumber is provided, update the label accordingly.
      let updateData = { ...data, label: getFloorLabel(newFloorNumber) };

      const updatedFloor = await prisma.floor.update({
        where: { id },
        data: updateData,
      });

      // If the updated floorNumber is 0, update the building record to set hasGroundFloor to true.
      if (typeof floorNumber === "number" && floorNumber === 0) {
        await prisma.building.update({
          where: { id: floor.buildingId },
          data: { hasGroundFloor: true },
        });
      }

      return NextResponse.json(
        {
          message: "Floor was updated successfully",
          floor: convertDatesToPhnomPenhTimezone(updatedFloor),
        },
        { status: 200 }
      );
    }
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
      select: { rooms: true, buildingId: true },
    });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 400 });
    }

    // Check if floor contain rooms
    if (floor.rooms.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete floor: it contain rooms" },
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
        message: "Floor was deleted successfully",
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
