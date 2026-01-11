// @/api/room/moveRooms/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/api/validate";
import { ApiResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth/auth";
import { UserRole } from "@prisma/client";
import { AuthError } from "@/lib/auth/errors";

// Move rooms to another floor by floor id
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const validIds = z
      .object({
        targetFloorId: z.string().uuid(),
        roomIds: z.array(z.string().uuid()).nonempty(),
      })
      .strict();
    const body = await request.json();
    const { roomIds, targetFloorId } = await validateRequest(validIds, body);

    // Validate provide room ids with existing rooms
    const existingRooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: {
        id: true,
        floorId: true,
        name: true,
      },
    });

    if (existingRooms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "None of the provided room ID(s) exist",
        },
        { status: 400 }
      );
    }

    if (existingRooms.length !== roomIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some provided room ID(s) do not exist",
        },
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
        {
          success: false,
          message: "Target floor does not exist",
        },
        { status: 400 }
      );
    }

    const targetBuilding = await prisma.building.findUnique({
      where: { id: targetFloor.buildingId },
      select: { name: true },
    });

    // Track old floor IDs for count updates
    const affectedOldFloorIds = [
      ...new Set(existingRooms.map((r) => r.floorId)),
    ];

    await prisma.$transaction(async (tx) => {
      // Move the rooms to the target floor
      await tx.room.updateMany({
        where: { id: { in: roomIds } },
        data: { floorId: targetFloorId },
      });

      // Update target floor room count
      const targetCount = await tx.room.count({
        where: { floorId: targetFloorId },
      });
      await tx.floor.update({
        where: { id: targetFloorId },
        data: { totalRooms: targetCount },
      });

      // Update target building room count
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

      // Update affected old floors
      for (const oldFloorId of affectedOldFloorIds) {
        const remainingRooms = await tx.room.count({
          where: { floorId: oldFloorId },
        });
        await tx.floor.update({
          where: { id: oldFloorId },
          data: { totalRooms: remainingRooms },
        });
      }
    });
    return ApiResponse.success({
      message: `${
        existingRooms.length
      } room(s) was moved successfully to floor ‘${
        targetFloor.floorNumber
      }’ of building ‘${targetBuilding!.name}’`,
      data: {
        "movedRoom(s)": existingRooms.map((r) => ({ id: r.id, name: r.name })),
      },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
