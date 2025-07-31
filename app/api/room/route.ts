// @/api/room/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RoomSchema } from "@/lib/validations/room";
import { LocalToUTC, fromUTCToLocal } from "@/utils/datetime";
import { getRoomName } from "@/utils/generateRoomName";
import { normalizeName } from "@/utils/normalizeName";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { z } from "zod";
import { validateRequest } from "@/lib/api/validate";
import { ApiResponse } from "@/lib/api/response";
import { BookingStatus } from "@prisma/client";

// CREATE Room
export async function POST(request: NextRequest) {
  try {
    let body = await request.json();
    const data = await validateRequest(RoomSchema, body);
    const { floorId } = data;

    // Ensure the provided floor exists and retrieve its buildingId and floorNumber
    const existingFloor = await prisma.floor.findUnique({
      where: { id: floorId },
      select: { buildingId: true, floorNumber: true },
    });
    if (!existingFloor) {
      return NextResponse.json(
        { 
          success: false,
          message: "Floor does not exist", 
        },
        { status: 400 },
      );
    }

    // Retrieve the building details to help generate the room name
    const building = await prisma.building.findUnique({
      where: { id: existingFloor.buildingId },
      select: { name: true },
    });
    if (!building) {
      return NextResponse.json(
        { 
          success: false,
          message: "Building for floor does not exist", 
        },
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
            success: false,
            message: `Cannot create room with name '${cleanedName}': It already exists`,
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
    const room = await prisma.room.create({
      data: {
        floorId,
        name: data.name,
        imageUrl: data.imageUrl,
        description: data.description,
        type: data.type,
        status: data.status,
        capacity: data.capacity,
        amenities: data.amenities,
        availableHours: data.availableHours,
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

    return ApiResponse.success({
      message: `Room(${room.name}) was successfully created on floor ${existingFloor.floorNumber} of building ${building.name}`,
      data: {
        ...room,
        availableHours: sortAvailableHours(
          room.availableHours as {
            dayOfWeek: string;
            startTime: string;
            endTime: string;
          }[]
        ),
        createdAt: fromUTCToLocal(room.createdAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
        updatedAt: fromUTCToLocal(room.updatedAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
      },
      status: 201,
    });
  } catch (error: unknown) {
    console.error("Room creation error:", error);
    return ApiResponse.error(error);
  }
}

// DELETE all rooms by floor/building/all; and skipping those with bookings
export async function DELETE(request: NextRequest) {
  try {
    const validIds = z
      .object({
        floorId: z.string().uuid().optional(),
        buildingId: z.string().uuid().optional(),
      })
      .strict();
    const body = await request.json();
    const { floorId, buildingId } = await validateRequest(validIds, body);

    // Build the filter
    const filter: Record<string, any> = {};

    // Allow only one criteria (floorId, or buildingId, or neither)
    if (floorId && buildingId) {
      return NextResponse.json(
        { 
          success: false,
          message: "Provide only one: either floorId or buildingId, not both" 
        },
        { status: 400 }
      );
    }

    if (floorId) {
      filter.floorId = floorId;
    } else if (buildingId) {
      filter.floor = { buildingId };
    }

    // Fetch all condidate rooms
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
        { 
          success: false,
          message: "No rooms found matching criteria" 
        },
        { status: 404 }
      );
    }

    const deletedRooms: string[] = [];
    const skippedRooms: string[] = [];
    const deletableRoomIds: string[] = [];
    
    // Get room IDs with approved bookings in a single query
    const approvedBookings = await prisma.booking.findMany({
      where: {
        roomId: { in: candidateRooms.map(r => r.id) },
        status: BookingStatus.approved,
      },
      select: { roomId: true },
      distinct: ['roomId'],
    });

    // Create a Set for quick lookup
    const roomsWithApprovedBookings = new Set(approvedBookings.map((b) => b.roomId));
    for (const room of candidateRooms) {
      if (roomsWithApprovedBookings.has(room.id)) {
        skippedRooms.push(room.name!)
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

    return ApiResponse.success({
      message: `Successfully deleted ${deletedRooms.length} room(s)${skippedRooms.length > 0 ? `; skipped ${skippedRooms.length} room(s) because of containing some active bookings` : ''}`,
      data: {
        "deletedRoom(s)": deletedRooms,
        "skippedRoom(s)": skippedRooms,
      },
    });
  } catch (error) {
    console.error("Room bulk deletion error:", error);
    return ApiResponse.error(error);
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

    let floorNumber: number;
    let buildingName: string;
    if (floorId) {
      const floor = await prisma.floor.findUnique({
        where: { id: floorId },
        select: {
          floorNumber: true,
          building: {
            select: { name: true },
          },
        },
      });
      if(!floor) {
        return NextResponse.json(
          { 
            success: false,
            message: "The provided floorId param does not exist for any floor" 
          },
          { status: 400 },
        );
      }
      floorNumber = floor.floorNumber;
      buildingName = floor.building.name;
      filter.floorId = floorId;
    } else if (buildingId) {
      const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { name: true },
      });
      if(!building) {
        return NextResponse.json(
          { 
            success: false,
            message: "The provided buildingId param does not exist for any building" 
          },
          { status: 400 },
        );
      }
      buildingName = building.name;
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

    const candidateRooms = await prisma.room.findMany({
      where: filter,
      include,
      orderBy: { name: "asc" },
    });

    // Filter out rooms with conflicting bookings
    const availableRooms = candidateRooms.filter((room) => {
      if (startDateTime && endDateTime) {
        return room.bookings.length === 0;
      }
      return true;
    });

    return ApiResponse.success({
      message: `Successfully get all(${availableRooms.length}) room(s)${`${ floorId
          ? ` belong to floor ${floorNumber!} of building ${buildingName!}`
          : ''
        }${ buildingId 
          ? ` in building ${buildingName!}` 
          : ''
        }`
      }`,
      data: {
        availableRooms: availableRooms.map((room) => ({
          id: room.id,
          floorId: room.floorId,
          imageUrl: room.imageUrl,
          name: room.name,
          type: room.type,
          status: room.status,
          capacity: room.capacity,
          amenities: room.amenities,
          availableHours: sortAvailableHours(
            room.availableHours as {
              dayOfWeek: string;
              startTime: string;
              endTime: string;
            }[]
          ),
          description: room.description,
          createdAt: fromUTCToLocal(room.createdAt).toFormat(
            "yyyy-LLL-dd hh:mm:ss a"
          ),
          updatedAt: fromUTCToLocal(room.updatedAt).toFormat(
            "yyyy-LLL-dd hh:mm:ss a"
          ),
        })),
      },
    });
  } catch (error) {
    console.error("Room search failed:", error);
    return ApiResponse.error(error);
  }
}