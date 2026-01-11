// @/api/room/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RoomSchema } from "@/lib/validations/room";
import { LocalToUTC, fromUTCToLocal } from "@/utils/datetime";
import { getRoomName } from "@/utils/generateRoomName";
import { normalizeName } from "@/utils/normalizeName";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { validateRequest } from "@/lib/api/validate";
import { ApiResponse } from "@/lib/api/response";
import { BookingStatus, RoomStatus, RoomType, UserRole } from "@prisma/client";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { AvailableHours } from "@/lib/validations/availableHoursSchema";

// CREATE Room
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const body = await request.json();
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
      message: `Room(${room.name}) was successfully created on floor ‘${existingFloor.floorNumber}’ of building ‘${building.name}’`,
      data: {
        ...room,
        availableHours: sortAvailableHours(
          room.availableHours as AvailableHours
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
    return ApiResponse.error(error);
  }
}

// GET rooms by filtering/searching
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const buildingId = searchParams.get("buildingId");
    const floorId = searchParams.get("floorId");
    const roomType = searchParams.get("type");
    const roomStatus = searchParams.get("status");
    const startDateTimeString = searchParams.get("from");
    const endDateTimeString = searchParams.get("to");

    // --- Validate date filters
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;
    if (
      (startDateTimeString && !endDateTimeString) ||
      (!startDateTimeString && endDateTimeString)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Both ‘from’ and ‘to’ parameters are required for availability filtering",
        },
        { status: 400 }
      );
    }
    if (startDateTimeString && endDateTimeString) {
      startDateTime = LocalToUTC(startDateTimeString);
      endDateTime = LocalToUTC(endDateTimeString);
    }

    // --- Prepare context info (for message)
    let floorNumber: number | undefined;
    let buildingName: string | undefined;

    if (floorId) {
      const floor = await prisma.floor.findUnique({
        where: { id: floorId },
        select: {
          floorNumber: true,
          building: { select: { name: true } },
        },
      });
      if (!floor) {
        return NextResponse.json(
          {
            success: false,
            message: "The provided floor does not exist",
          },
          { status: 400 }
        );
      }
      floorNumber = floor.floorNumber;
      buildingName = floor.building.name;
    } else if (buildingId) {
      const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { name: true },
      });
      if (!building) {
        return NextResponse.json(
          {
            success: false,
            message: "The provided building does not exist",
          },
          { status: 400 }
        );
      }
      buildingName = building.name;
    }

    // --- filters
    const filter: any = {
      ...(floorId ? { floorId } : {}),
      ...(buildingId && !floorId ? { floor: { buildingId } } : {}),
      ...(roomType ? { type: roomType as RoomType } : {}),
      ...(roomStatus ? { status: roomStatus as RoomStatus } : {}),
    };

    // -- search
    if (search) {
      const parsedCapacity = parseInt(search, 10);
      filter.OR = [
        { name: { contains: search, mode: "insensitive" } },
        ...(isNaN(parsedCapacity)
          ? []
          : [{ capacity: { gte: parsedCapacity } }]),
        { amenities: { has: search } },
      ];
    }

    // --- Query rooms
    let rooms;
    const baseWhere: any = {
      AND: [filter],
    };
    if (startDateTime && endDateTime) {
      // Exclude conflicting rooms directly
      baseWhere.NOT = {
        bookings: {
          some: {
            startDateTime: { lt: endDateTime },
            endDateTime: { gt: startDateTime },
          },
        },
      };
    }
    rooms = await prisma.room.findMany({
      where: baseWhere,
      orderBy: [
        { floor: { floorNumber: "asc" } },
        { name: "asc" },
      ]
    })

    // --- Response context message
    const contextMessage = floorId
      ? ` on floor ${floorNumber} of building ‘${buildingName}’`
      : buildingId
      ? ` in building ‘${buildingName}’`
      : "";

    return ApiResponse.success({
      message: `Successfully fetched ${rooms.length} room(s)${contextMessage}`,
      data: rooms.map((room) => ({
        id: room.id,
        floorId: room.floorId,
        imageUrl: room.imageUrl,
        name: room.name,
        type: room.type,
        status: room.status,
        capacity: room.capacity,
        amenities: room.amenities,
        availableHours: sortAvailableHours(room.availableHours as AvailableHours),
        description: room.description,
        createdAt: fromUTCToLocal(room.createdAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
        updatedAt: fromUTCToLocal(room.updatedAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
      })),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
