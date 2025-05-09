// @/api/room/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { sortAvailableHours } from "@/lib/sortAvailableHours";
import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";
import { id } from "date-fns/locale";

// GET Single Room
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: params.id },
      include: {
        floor: {
          include: {
            building: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Sort availableHours before sending response
    const sortedRoom = {
      ...room,
      availableHours: sortAvailableHours(room.availableHours),
    };
    
    return NextResponse.json(convertDatesToPhnomPenhTimezone(sortedRoom), { status: 200 });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

// UPDATE Room
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = RoomUpdateSchema.parse(body);
    const { name } = data;
    const isRoom = await prisma.room.findUnique({ where: { id: params.id } });

    if(!isRoom) return NextResponse.json({ error: 'Room does not exist' }, { status: 400 });
    
    if(typeof name === "string") {
      const existingName = await prisma.room.findFirst({ where: { name } });
      if(existingName) return NextResponse.json({ error: `Cannot change name to '${name}': It already exist` }, { status: 400 });
    }

    const room = await prisma.room.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

// DELETE Room
export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const room = await prisma.room.findUnique({ where: { id: params.id }, select: { floorId: true } });
    if(!room) return NextResponse.json({ error: 'Room does not exist' }, { status: 400 });
    
    const floor = await prisma.floor.findUnique({ where: { id: room?.floorId }, select: { buildingId: true } });
    
    await prisma.room.delete({ where: { id: params.id } });
    
    const roomCountOnFloor = await prisma.room.count({ where: { floor: { id: room?.floorId } } });
    const roomCountInBuilding = await prisma.room.count({ where: { floor: { buildingId:floor?.buildingId } } });
    
    await Promise.all([
      prisma.floor.update({
        where: { id: room?.floorId },
        data: { totalRooms: roomCountOnFloor }
      }),
      prisma.building.update({
        where: { id: floor?.buildingId },
        data: { totalRooms: roomCountInBuilding }
      })
    ]);

    return NextResponse.json({ message: "Room was deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
