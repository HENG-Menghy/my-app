// @/api/room/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoomSchema } from "@/lib/validations/room";
import { HandleZodError } from "@/lib/validationError";
import { sortAvailableHours } from "@/lib/sortAvailableHours";
import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { fromZonedTime } from "date-fns-tz";

// CREATE Room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = RoomSchema.parse(body);
    const { floorId, name } = data;
    const existingFloor = await prisma.floor.findUnique({
      where: { id: floorId },
    });
    const existingRoomName = await prisma.room.findFirst({ where: { name } });
    if (!existingFloor)
      return NextResponse.json(
        { error: "Floor does not exist" },
        { status: 400 }
      );
    if (existingRoomName)
      return NextResponse.json(
        { error: `Cannot create room with name ''${name}': It already exist` },
        { status: 400 }
      );

    // Create the room
    const room = await prisma.room.create({ data });

    // Count updated total rooms on the floor
    const roomCountOnFloor = await prisma.room.count({
      where: { floorId: floorId },
    });

    // Get the buildingId from the floor
    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      select: { buildingId: true },
    });

    // Count updated total rooms in the building
    const roomCountInBuilding = await prisma.room.count({
      where: { floor: { buildingId: floor?.buildingId } },
    });

    // Update totalRooms on Floor
    await prisma.floor.update({
      where: { id: floorId },
      data: { totalRooms: roomCountOnFloor },
    });

    // Update totalRooms on Building
    if (floor?.buildingId) {
      await prisma.building.update({
        where: { id: floor.buildingId },
        data: { totalRooms: roomCountInBuilding },
      });
    }

    return NextResponse.json(convertDatesToPhnomPenhTimezone(room), {
      status: 201,
    });
  } catch (error) {
    return HandleZodError(error);
  }
}

// GET all rooms
export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        floor: {
          select: {
            id: true,
            floorNumber: true,
            building: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Sort availableHours before sending response
    const sortedRooms = rooms.map((room) => ({
      ...room,
      availableHours: sortAvailableHours(room.availableHours),
    }));

    return NextResponse.json(convertDatesToPhnomPenhTimezone(sortedRooms), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

// DELETE all rooms
export async function DELETE(request: NextRequest) {
  try {
    // Parse query parameters from the request URL
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId");
    const floorId = searchParams.get("floorId");
    const amenities = searchParams.getAll("amenities");
    const capacity = searchParams.get("capacity");
    const roomType = searchParams.get("type");
    const roomStatus = searchParams.get("status");
    const dateStr = searchParams.get("date"); // expected format: YYYY-MM-DD
    const startTimeStr = searchParams.get("startTime"); // expected format: HH:MM
    const endTimeStr = searchParams.get("endTime"); // expected format: HH:MM

    // Build a dynamic filter for the room query based on provide query parameters
    const filter: Record<string, any> = {};
    // If floorId is provided, limit to that floor; otherwise, if buildingId is provided, filter by the building of the floor
    if (floorId) {
      filter.floorId = floorId;
    } else if (buildingId) {
      filter.floor = { buildingId: buildingId };
    }

    if (capacity) {
      filter.capacity.lte = parseInt(capacity, 10);
    }

    if (roomType) {
      filter.roomType = roomType;
    }

    if (roomStatus) {
      filter.roomStatus = roomStatus;
    }

    // For amenities, we assume that the room model has an array column and we want to require every amenity listed
    if (amenities && amenities.length > 0) {
      filter.amenities = { hasEvery: amenities };
    }

    // Fetch all candidate rooms matching the filter
    // We also select the 'floor' relationship (to know buildingId) for later updates
    const candidateRooms = await prisma.room.findMany({
      where: filter,
      select: {
        id: true,
        floorId: true,
        floor: { select: { buildingId: true } },
      },
    });

    // Prepare arrays for result tracking
    const deletedRoomIds: string[] = [];
    const skippedRoomIds: string[] = [];

    // If date, startTime, and endTime are provided, then prepare datetime objects
    const timeZone = "Asia/Phnom_Penh";
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;
    if (dateStr && startTimeStr && endTimeStr) {
      const startDateTimeString = `${dateStr}T${startTimeStr}:00`;
      const endDateTimeString = `${dateStr}T${endTimeStr}:00`;
      startDateTime = fromZonedTime(startDateTimeString, timeZone);
      endDateTime = fromZonedTime(endDateTimeString, timeZone);
    }

    // Loop over candidate rooms and check for overlapping bookings if necessary
    for (const room of candidateRooms) {
      let hasOverlappingBooking = false;

      if (startDateTime && endDateTime) {
        // Look for bookings that overlap the specified time range
        // The overlap check uses the condition: booking.startTime < deletionPeriodEnd AND booking.endTime > deletionPeriodStart.
        const overlappingBooking = await prisma.booking.findFirst({
          where: {
            roomId: room.id,
            AND: [
              { startDateTime: { lt: endDateTime } },
              { endDateTime: { gt: startDateTime } },
            ],
          },
        });
        if (overlappingBooking) {
          hasOverlappingBooking = true;
        }
      }

      // Based on the availability check, decide whether to delete or skip the room
      if (hasOverlappingBooking) {
        skippedRoomIds.push(room.id);
      } else {
        deletedRoomIds.push(room.id);
      }
    }

    // Wrap deletions and subsequent updates in a transaction to maintain data consistency
    if (deletedRoomIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Delete eligible rooms using a deleteMany operation.
        await tx.room.deleteMany({
          where: { id: { in: deletedRoomIds } },
        });

        // Update room counts on affected floors
        // Extract unique floorIds from the deleted rooms
        const floorIds = candidateRooms
          .filter((r) => deletedRoomIds.includes(r.id))
          .map((r) => r.floorId);
        const uniqueFloorIds = Array.from(new Set(floorIds));

        // Update each floor's totalRooms count
        for (const fId of uniqueFloorIds) {
          const roomCount = await tx.room.count({
            where: { floorId: fId },
          });
          await tx.floor.update({
            where: { id: fId },
            data: { totalRooms: roomCount },
          });
        }

        // Now update the room counts on affected buildings.
        const buildingIds: string[] = [];
        // Collect buildingIds from each affected floor.
        for (const fId of uniqueFloorIds) {
          const floorData = await tx.floor.findUnique({
            where: { id: fId },
            select: { buildingId: true },
          });
          if (
            floorData?.buildingId &&
            !buildingIds.includes(floorData.buildingId)
          ) {
            buildingIds.push(floorData.buildingId);
          }
        }

        // For each building, recalculate the total rooms scope
        for (const bId of buildingIds) {
          const roomCount = await tx.room.count({
            where: { floor: { buildingId: bId } },
          });
          await tx.building.update({
            where: { id: bId },
            data: { totalRooms: roomCount },
          });
        }
      });
    }

    // Build a summary response message.
    const message = `Operation complete: deleted ${deletedRoomIds.length} room(s) and skipped ${skippedRoomIds.length} room(s) due to overlapping bookings.`;

    return NextResponse.json(
      { deletedRoomIds, skippedRoomIds, message },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to delete rooms" },
      { status: 500 }
    );
  }
}