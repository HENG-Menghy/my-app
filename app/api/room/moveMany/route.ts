// @/api/room/moveMany/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRoomName } from "@/utils/generateRoomName";

// Move rooms to another floor by floor id
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomIds, targetFloorId } = body;

    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return NextResponse.json(
        { error: "No room IDs provided" },
        { status: 400 }
      );
    }

    if (!targetFloorId) {
      return NextResponse.json(
        { error: "Target floorId is required" },
        { status: 400 }
      );
    }

    // Validate target floor
    const targetFloor = await prisma.floor.findUnique({
      where: { id: targetFloorId },
      select: { id: true, floorNumber: true, buildingId: true },
    });

    if (!targetFloor) {
      return NextResponse.json(
        { error: "Target floor does not exist" },
        { status: 400 }
      );
    }

    const targetBuilding = await prisma.building.findUnique({
      where: { id: targetFloor.buildingId },
      select: { name: true },
    });

    if (!targetBuilding) {
      return NextResponse.json(
        { error: "Target building not found" },
        { status: 400 }
      );
    }

    // Fetch rooms to move
    const roomsToMove = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      orderBy: { createdAt: "asc" },
    });

    if (roomsToMove.length === 0) {
      return NextResponse.json(
        { error: "None of the provided room IDs exist" },
        { status: 404 }
      );
    }

    // Track old floor IDs for count updates
    const affectedOldFloorIds = Array.from(
      new Set(roomsToMove.map((r) => r.floorId))
    );

    const movedRoomNames: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Get current room count on target floor (excluding these moving rooms)
      const existingTargetRooms = await tx.room.findMany({
        where: {
          floorId: targetFloorId,
        },
        orderBy: { createdAt: "asc" },
      });

      let newIndex = existingTargetRooms.length;

      for (let i = 0; i < roomsToMove.length; i++) {
        const room = roomsToMove[i];

        // Generate new name
        const newName = getRoomName(
          targetBuilding.name,
          targetFloor.floorNumber,
          newIndex
        );

        await tx.room.update({
          where: { id: room.id },
          data: {
            floorId: targetFloorId,
            name: newName,
          },
        });

        movedRoomNames.push(newName);
        newIndex++;
      }

      // Update target floor room count
      const targetCount = await tx.room.count({
        where: { floorId: targetFloorId },
      });

      await tx.floor.update({
        where: { id: targetFloorId },
        data: { totalRooms: targetCount },
      });

      // Update target building count
      const allTargetFloorIds = (
        await tx.floor.findMany({
          where: { buildingId: targetFloor.buildingId },
          select: { id: true },
        })
      ).map((f) => f.id);

      const totalRoomsInTargetBuilding = await tx.room.count({
        where: { floorId: { in: allTargetFloorIds } },
      });

      await tx.building.update({
        where: { id: targetFloor.buildingId },
        data: { totalRooms: totalRoomsInTargetBuilding },
      });

      // Update room counts and re-label rooms on old floors
      for (const oldFloorId of affectedOldFloorIds) {
        const remainingRooms = await tx.room.findMany({
          where: { floorId: oldFloorId },
          orderBy: { createdAt: "asc" },
        });

        const oldFloorData = await tx.floor.findUnique({
          where: { id: oldFloorId },
          select: { floorNumber: true, buildingId: true },
        });

        if (!oldFloorData) continue;

        const oldBuilding = await tx.building.findUnique({
          where: { id: oldFloorData.buildingId },
          select: { name: true },
        });

        if (!oldBuilding) continue;

        // Re-label room names on old floor
        for (let i = 0; i < remainingRooms.length; i++) {
          const expectedName = getRoomName(
            oldBuilding.name,
            oldFloorData.floorNumber,
            i
          );
          if (remainingRooms[i].name !== expectedName) {
            await tx.room.update({
              where: { id: remainingRooms[i].id },
              data: { name: expectedName },
            });
          }
        }

        await tx.floor.update({
          where: { id: oldFloorId },
          data: { totalRooms: remainingRooms.length },
        });

        const oldFloorIds = (
          await tx.floor.findMany({
            where: { buildingId: oldFloorData.buildingId },
            select: { id: true },
          })
        ).map((f) => f.id);

        const totalOldRooms = await tx.room.count({
          where: { floorId: { in: oldFloorIds } },
        });

        await tx.building.update({
          where: { id: oldFloorData.buildingId },
          data: { totalRooms: totalOldRooms },
        });
      }
    });

    return NextResponse.json(
      {
        message: `${roomsToMove.length} room(s) successfully moved to floor ${targetFloor.floorNumber} of building ${targetBuilding.name}`,
        newMovedRooms: movedRoomNames,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error moving rooms:", error);
    return NextResponse.json(
      { error: "Failed to move rooms" },
      { status: 500 }
    );
  }
}
