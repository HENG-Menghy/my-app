// @/api/room/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RoomSchema } from "@/lib/validations/room";
import { HandleZodError } from "@/utils/validationError";
import { LocalToUTC, fromUTCToLocal } from "@/utils/datetime";
import {
  defaultAmenities,
  defaultAvailability,
  defaultCapacity,
} from "@/utils/defaultRoomInfo";
import { getRoomName } from "@/utils/generateRoomName";
import { normalizeName } from "@/utils/normalizeName";
import { Prisma } from "@prisma/client";
import { sortAvailabilityByDay } from "@/utils/sortAvailability";

// CREATE Room
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();

    // Apply defaults
    const availability = body.availability ?? defaultAvailability;
    body.capacity ??= defaultCapacity;
    body.amenities =
      Array.isArray(body.amenities) && body.amenities.length > 0
        ? body.amenities
        : defaultAmenities;

    // Temporarily remove availability before schema validation
    delete body.availability;

    // Validate and parse the request using RoomSchema.
    const data = RoomSchema.parse(body);
    const { floorId } = data;

    // Ensure the provided floor exists and retrieve its buildingId and floorNumber
    const existingFloor = await prisma.floor.findUnique({
      where: { id: floorId },
      select: { buildingId: true, floorNumber: true },
    });
    if (!existingFloor) {
      return NextResponse.json(
        { error: "Floor does not exist" },
        { status: 400 }
      );
    }

    // Retrieve the building details to help generate the room name
    const building = await prisma.building.findUnique({
      where: { id: existingFloor.buildingId },
      select: { name: true },
    });
    if (!building) {
      return NextResponse.json(
        { error: "Building for floor does not exist" },
        { status: 400 }
      );
    }

    // Count current rooms on this floor to determine the next room number
    const roomCountOnFloor = await prisma.room.count({
      where: { floorId },
    });

    // Process the room name:
    // If a name is provided, clean it (trim and convert to Title Case) and check for duplicates
    // If not provided or empty, generate a default room name
    if (data.name && data.name.trim() !== "") {
      const cleanedName = normalizeName(data.name);
      data.name = cleanedName;
      const duplicateRoom = await prisma.room.findFirst({
        where: { name: { equals: cleanedName, mode: "insensitive" } },
      });
      if (duplicateRoom) {
        return NextResponse.json(
          {
            error: `Cannot create room with name '${cleanedName}': It already exists`,
          },
          { status: 400 }
        );
      }
    } else {
      data.name = getRoomName(
        building.name,
        existingFloor.floorNumber,
        roomCountOnFloor
      );
    }

    // Create the room
    const roomData: Prisma.RoomCreateInput = {
      floor: {
        connect: { id: data.floorId },
      },
      name: data.name!,
      imageUrl: data.imageUrl,
      description: data.description,
      type: data.type,
      status: data.status,
      capacity: data.capacity!,
      amenities: data.amenities!,
      availability: {
        create: availability.map((slot: any) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable:
            slot.isAvailable ?? (slot.startTime !== "" && slot.endTime !== ""),
        })),
      },
    };

    const room = await prisma.room.create({
      data: roomData,
      include: {
        availability: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Update room counts on the floor
    const newRoomCountOnFloor = await prisma.room.count({
      where: { floorId },
    });
    await prisma.floor.update({
      where: { id: floorId },
      data: { totalRooms: newRoomCountOnFloor },
    });

    // Update room counts in the entire building
    const floorsInBuilding = await prisma.floor.findMany({
      where: { buildingId: existingFloor.buildingId },
      select: { id: true },
    });
    const allFloorIds = floorsInBuilding.map((f) => f.id);
    const newRoomCountInBuilding = await prisma.room.count({
      where: { floorId: { in: allFloorIds } },
    });
    await prisma.building.update({
      where: { id: existingFloor.buildingId },
      data: { totalRooms: newRoomCountInBuilding },
    });

    return NextResponse.json(
      {
        message: "Room was created successfully",
        room: {
          ...room,
          availability: sortAvailabilityByDay(room.availability),
          createdAt: fromUTCToLocal(room.createdAt).toFormat('yyyy LLL dd hh:mm:ss a'),
          updatedAt: fromUTCToLocal(room.updatedAt).toFormat('yyyy LLL dd hh:mm:ss a'),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Room creation error:", error);
    return HandleZodError(error);
  }
}

// DELETE all rooms within floor or building and skips rooms that have overlapping bookings
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId");
    const floorId = searchParams.get("floorId");

    // Ensure exactly one of buildingId or floorId is provided
    if (!floorId && !buildingId) {
      return NextResponse.json(
        { error: "Either floorId or buildingId must be provided." },
        { status: 400 }
      );
    }

    if (floorId && buildingId) {
      return NextResponse.json(
        { error: "Provide only one: either floorId or buildingId, not both." },
        { status: 400 }
      );
    }

    // Build the base filter
    const filter: Record<string, any> = {};
    if (floorId) {
      filter.floorId = floorId;
    } else {
      filter.floor = { buildingId };
    }

    // Fetch all rooms to consider
    const candidateRooms = await prisma.room.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        floorId: true,
        floor: { select: { buildingId: true } },
      },
    });

    if (candidateRooms.length === 0) {
      return NextResponse.json(
        { message: "No rooms found matching criteria" },
        { status: 404 }
      );
    }

    const deletedRooms: string[] = [];
    const skippedRooms: { name: string; reason: string }[] = [];
    const deletableRoomIds: string[] = [];

    // Check if each room has any bookings
    for (const room of candidateRooms) {
      const hasAnyBookings = await prisma.booking.findFirst({
        where: { roomId: room.id },
        select: { id: true },
      });

      if (hasAnyBookings) {
        skippedRooms.push({
          name: room.name!,
          reason: "Room contains one or more bookings",
        });
      } else {
        deletableRoomIds.push(room.id);
        deletedRooms.push(room.name!);
      }
    }

    if (deletableRoomIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Delete the rooms
        await tx.room.deleteMany({ where: { id: { in: deletableRoomIds } } });

        // Update totalRooms on affected floors
        const floorIds = [
          ...new Set(
            candidateRooms
              .filter((room) => deletableRoomIds.includes(room.id))
              .map((room) => room.floorId)
          ),
        ];

        for (const floorId of floorIds) {
          const roomCount = await tx.room.count({ where: { floorId } });
          await tx.floor.update({
            where: { id: floorId },
            data: { totalRooms: roomCount },
          });
        }

        // Update totalRooms on affected buildings
        const buildingIds = [
          ...new Set(
            candidateRooms
              .filter((room) => deletableRoomIds.includes(room.id))
              .map((room) => room.floor.buildingId)
          ),
        ];

        for (const buildingId of buildingIds) {
          const roomCount = await tx.room.count({
            where: { floor: { buildingId } },
          });
          await tx.building.update({
            where: { id: buildingId },
            data: { totalRooms: roomCount },
          });
        }
      });
    }

    return NextResponse.json(
      {
        message: `Deleted ${deletedRooms.length} room(s), skipped ${skippedRooms.length} room(s).`,
        deletedRooms,
        skippedRooms,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Room bulk deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete rooms" },
      { status: 500 }
    );
  }
}

// GET rooms by filtering/searching
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId");
    const floorId = searchParams.get("floorId");
    const roomName = searchParams.get("name")?.toLowerCase();
    const amenity = searchParams.get("amenities");
    const capacity = searchParams.get("capacity");
    const roomType = searchParams.get("type");
    const roomStatus = searchParams.get("status");
    const startDateTimeString = searchParams.get("from");
    const endDateTimeString = searchParams.get("to");

    // Time filtering setup
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (startDateTimeString && endDateTimeString) {
      startDateTime = LocalToUTC(startDateTimeString);
      endDateTime = LocalToUTC(endDateTimeString);
    }

    // Build initial room filter
    const filter: Record<string, any> = {};

    if (floorId) {
      filter.floorId = floorId;
    } else if (buildingId) {
      filter.floor = { buildingId };
    }

    if (roomName?.trim()) {
      filter.name = { contains: roomName.trim(), mode: "insensitive" };
    }

    if (capacity) {
      filter.capacity = { gte: parseInt(capacity) };
    }

    if (roomType) {
      filter.type = roomType;
    }

    if (roomStatus) {
      filter.status = roomStatus;
    }

    if (amenity?.trim()) {
      filter.amenities = { has: amenity.trim() };
    }

    const include = {
      floor: {
        select: {
          id: true,
          floorNumber: true,
          building: { select: { id: true, name: true } },
        },
      },
      ...(startDateTime &&
        endDateTime && {
          bookings: {
            where: {
              startDateTime: { lt: endDateTime },
              endDateTime: { gt: startDateTime },
            },
            select: { id: true },
          },
        }),
    } as const;

    const candidateRooms: Prisma.RoomGetPayload<{
      include: typeof include;
    }>[] = await prisma.room.findMany({
      where: filter,
      include,
      orderBy: { capacity: "asc" },
    });

    // Filter out rooms with conflicting bookings
    const availableRooms = candidateRooms.filter((room) => {
      if (startDateTime && endDateTime) {
        return room.bookings.length === 0;
      }
      return true;
    });

    return NextResponse.json(
      {
        total: availableRooms.length,
        availableRooms: availableRooms.map((room) => ({
          id: room.id,
          imageUrl: room.imageUrl,
          name: room.name,
          capacity: room.capacity,
          type: room.type,
          status: room.status,
          amenities: room.amenities,
          floor: {
            id: room.floor.id,
            floorNumber: room.floor.floorNumber,
            building: room.floor.building,
          },
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Room search failed:", error);
    return NextResponse.json(
      { error: "Failed to filter rooms" },
      { status: 500 }
    );
  }
}