// @/api/room/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoomSchema } from "@/lib/validations/room";
import { HandleZodError } from "@/lib/validationError";
import { sortAvailableHours } from "@/app/lib/sortAvailableHours";
import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";

// CREATE Room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = RoomSchema.parse(body);
    
    // Create the room
    const room = await prisma.room.create({ data });
    
    // Count updated total rooms on the floor
    const floorRoomCount = await prisma.room.count({
      where: { floorId: data.floorId }
    });

    // Get the buildingId from the floor
    const floor = await prisma.floor.findUnique({
      where: { id: data.floorId },
      select: { buildingId: true }
    });

    // Count updated total rooms in the building
    const buildingRoomCount = await prisma.room.count({
      where: { floor: { buildingId: floor?.buildingId } },
    });

    // Update totalRooms on Floor
    await prisma.floor.update({
      where: { id: data.floorId },
      data: { totalRooms: floorRoomCount },
    });

    // Update totalRooms on Building
    if (floor?.buildingId) {
      await prisma.building.update({
        where: { id: floor.buildingId },
        data: { totalRooms: buildingRoomCount },
      });
    }

    return NextResponse.json(convertDatesToPhnomPenhTimezone(room), { status: 201 });
  } catch (error) {
    return HandleZodError(error);
  }
}

// GET All Rooms
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
                address: true
              }
            }
          }
        }
      },
      orderBy: { name: "asc" },
    });

    // Sort availableHours before sending response
    const sortedRooms = rooms.map((room) => ({
      ...room,
      availableHours: sortAvailableHours(room.availableHours),
    }));

    return NextResponse.json(convertDatesToPhnomPenhTimezone(sortedRooms), { status: 200} );
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

