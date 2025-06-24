// @/api/floor/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { FloorUpdateSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { HandleZodError } from "@/utils/validationError";
import { FormattedDateDisplay } from "@/utils/datetime";
import { getRoomName } from "@/utils/generateRoomName";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import {
  defaultAmenities,
  defaultAvailability,
  defaultCapacity,
} from "@/utils/defaultRoomInfo";
import { normalizeName } from "@/utils/normalizeName";
import { RoomStatus, RoomType } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const body = await request.json();
    const data = FloorUpdateSchema.parse(body);
    const { floorNumber, totalRooms, name } = data;

    // Retrieve existing floor details
    const floor = await prisma.floor.findUnique({
      where: { id },
      select: {
        buildingId: true,
        floorNumber: true,
        name: true,
        totalRooms: true,
      },
    });
    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    // Check for conflicting floor number
    if (floorNumber !== undefined && floorNumber !== floor.floorNumber) {
      const existingFloor = await prisma.floor.findFirst({
        where: { buildingId: floor.buildingId, floorNumber },
      });
      if (existingFloor) {
        return NextResponse.json(
          { error: `Floor ${floorNumber} already exists` },
          { status: 400 }
        );
      }
    }

    // Check for conflicting floor name
    if (name && name.trim() !== "" && name.trim() !== floor.name) {
      const cleanName = normalizeName(name);
      const existingName = await prisma.floor.findFirst({
        where: {
          name: {
            equals: cleanName,
            mode: "insensitive",
          },
          NOT: { id },
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

    // Retrieve the building for room naming and to get its current hasGroundFloor flag
    const building = await prisma.building.findUnique({
      where: { id: floor.buildingId },
      select: { name: true, hasGroundFloor: true },
    });
    if (!building) {
      return NextResponse.json(
        { error: "Building for floor not found" },
        { status: 404 }
      );
    }

    // Determine new values for this floor
    const newFloorNumber = floorNumber ?? floor.floorNumber;
    const newTotalRooms = totalRooms ?? floor.totalRooms;

    // Fetch existing rooms on this floor
    const rooms = await prisma.room.findMany({
      where: { floorId: id },
      select: { id: true, name: true, bookings: { select: { id: true } } },
    });

    await prisma.$transaction(async (tx) => {
      // ─── If floor number changes, update room names accordingly ─────────────
      if (floorNumber !== undefined && floorNumber !== floor.floorNumber) {
        await Promise.all(
          rooms.map((room, index) =>
            tx.room.update({
              where: { id: room.id },
              data: {
                name: getRoomName(building!.name, newFloorNumber, index),
              },
            })
          )
        );
      }

      // ─── Adjust room count on this floor ─────────────────────────────
      if (totalRooms !== undefined && newTotalRooms !== rooms.length) {
        if (newTotalRooms > rooms.length) {
          // Add additional rooms.
          const additionalCount = newTotalRooms - rooms.length;
          const additionalRooms = Array.from({ length: additionalCount }).map(
            (_, i) => ({
              name: getRoomName(
                building!.name,
                newFloorNumber,
                rooms.length + i
              ),
              floorId: id,
              type: RoomType.meeting,
              capacity: defaultCapacity,
              amenities: defaultAmenities,
              availableHours: defaultAvailability,
              status: RoomStatus.active,
            })
          );
          await tx.room.createMany({ data: additionalRooms });
        } else if (newTotalRooms < rooms.length) {
          // Delete excess rooms (only if they have no active bookings)
          const roomsToDelete = rooms
            .filter(
              (room, idx) => idx >= newTotalRooms && room.bookings.length === 0
            )
            .map((room) => room.id);

          const blockedRooms = rooms
            .filter(
              (room, idx) => idx >= newTotalRooms && room.bookings.length > 0
            )
            .map((room) => room.name);

          if (blockedRooms.length > 0) {
            return NextResponse.json(
              {
                error: "Cannot reduce room count due to active bookings",
                roomsWithBookings: blockedRooms,
              },
              { status: 400 }
            );
          }

          await tx.room.deleteMany({ where: { id: { in: roomsToDelete } } });
        }
      }

      // ─── Update the floor record first ─────────────────────────────
      // This ensures that any subsequent recalc of building totals will pick up the new floor values.
      await tx.floor.update({
        where: { id },
        data: {
          ...data, // contains floorNumber, totalRooms, name (if provided)
          label: getFloorLabel(newFloorNumber),
        },
      });

      // ─── Recalculate building totals ─────────────────────────────
      // Fetch all floors currently in the building (including the updated one).
      const floorsAfter = await tx.floor.findMany({
        where: { buildingId: floor.buildingId },
        select: { id: true, floorNumber: true },
      });
      // Use these floor IDs to count rooms.
      const floorIds = floorsAfter.map((f) => f.id);
      const roomCountInBuilding = await tx.room.count({
        where: { floorId: { in: floorIds } },
      });
      // Business rule: building.totalFloors represents only the numbered floors (floors 1 .. N).
      // If a ground floor (floorNumber === 0) exists, subtract one.
      const updatedHasGroundFloor = floorsAfter.some(
        (f) => f.floorNumber === 0
      );
      const newTotalNumberedFloors = updatedHasGroundFloor
        ? floorsAfter.length - 1
        : floorsAfter.length;

      // Update the building record accordingly.
      await tx.building.update({
        where: { id: floor.buildingId },
        data: {
          totalRooms: roomCountInBuilding,
          totalFloors: newTotalNumberedFloors,
          hasGroundFloor: updatedHasGroundFloor,
        },
      });
    });

    const updatedFloor = await prisma.floor.findUnique({ where: { id } });

    return NextResponse.json(
      {
        message: "Floor updated successfully",
        updatedFloor: FormattedDateDisplay(updatedFloor),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Floor update error:", error);
    return HandleZodError(error);
  }
}

// Get floor by id
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const floor = await prisma.floor.findUnique({
      where: { id },
      include: {
        rooms: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    return NextResponse.json(FormattedDateDisplay(floor), {
      status: 200,
    });
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
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Retrieve floor details
    const floor = await prisma.floor.findUnique({
      where: { id },
      select: {
        id: true,
        buildingId: true,
        floorNumber: true,
        rooms: { select: { id: true } },
      },
    });

    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    await prisma.floor.delete({ where: { id } });

    // 1. Retrieve all the remaining floors for this building
    const remainingFloors = await prisma.floor.findMany({
      where: { buildingId: floor.buildingId },
      select: { id: true, floorNumber: true },
      orderBy: { floorNumber: "asc" },
    });

    // 2. Calculate new total numbered floors
    const newTotalFloors = remainingFloors.some((f) => f.floorNumber === 0)
      ? remainingFloors.length - 1
      : remainingFloors.length;

    // 3. Count all rooms of the remaining floors by collecting their IDs.
    const remainingFloorIds = remainingFloors.map((f) => f.id);
    const newTotalRooms = await prisma.room.count({
      where: { floorId: { in: remainingFloorIds } },
    });

    // 4. Update the building with the new totals and updated ground floor flag.
    await prisma.building.update({
      where: { id: floor.buildingId },
      data: {
        totalFloors: newTotalFloors,
        totalRooms: newTotalRooms,
        hasGroundFloor: remainingFloors.some((f) => f.floorNumber === 0),
      },
    });

    return NextResponse.json(
      {
        message: "Floor was deleted successfully",
        deletedId: id,
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
