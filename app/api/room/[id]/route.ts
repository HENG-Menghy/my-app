// @/api/room/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { sortAvailableHours } from "@/lib/sortAvailableHours";
import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";

// GET Single Room
export async function GET(
  request: NextRequest,
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
    const isRoom = await prisma.room .findUnique({ where: { id: params.id } });

    if(!isRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 400 });
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
    await prisma.room.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
