// @/api/room/deleteMany/route.ts

import prisma from "@/lib/db/prisma";
import { HandleZodError } from "@/utils/validationError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function DELETE(request: NextRequest) {
  try {
    const validRoomIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const ids = validRoomIds.parse(body);

    // Fetch rooms including bookings and names
    const roomsToProcess = await prisma.room.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        floorId: true,
        bookings: { select: { id: true } },
      },
    });

    if (roomsToProcess.length === 0) {
      return NextResponse.json(
        { error: "None of the provided room IDs exist" },
        { status: 404 }
      );
    }

    const deletableRooms = roomsToProcess.filter(
      (room) => room.bookings.length === 0
    );
    const blockedRooms = roomsToProcess.filter(
      (room) => room.bookings.length > 0
    );

    const deletedRoomIds = deletableRooms.map((room) => room.id);
    const deletedRoomNames = deletableRooms.map((room) => room.name);

    const skippedRooms = blockedRooms.map((room) => ({
      name: room.name,
      reason: "Room contains bookings",
    }));

    // Delete only the rooms that can be deleted
    if (deletedRoomIds.length > 0) {
      await prisma.room.deleteMany({
        where: { id: { in: deletedRoomIds } },
      });

      // Update floors affected
      const floorIds = [...new Set(deletableRooms.map((room) => room.floorId))];
      const floors = await prisma.floor.findMany({
        where: { id: { in: floorIds } },
        select: { id: true, buildingId: true },
      });
      const buildingIds = [...new Set(floors.map((floor) => floor.buildingId))];

      const floorUpdatePromises = floorIds.map(async (floorId) => {
        const roomCount = await prisma.room.count({ where: { floorId } });
        return prisma.floor.update({
          where: { id: floorId },
          data: { totalRooms: roomCount },
        });
      });

      const buildingUpdatePromises = buildingIds.map(async (buildingId) => {
        const roomCount = await prisma.room.count({
          where: { floor: { buildingId } },
        });
        return prisma.building.update({
          where: { id: buildingId },
          data: { totalRooms: roomCount },
        });
      });

      await Promise.all([...floorUpdatePromises, ...buildingUpdatePromises]);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Room deletion successfully processed",
        deletedRooms: deletedRoomNames,
        skippedRooms,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during bulk deletion:", error);
    return HandleZodError(error);
  }
}