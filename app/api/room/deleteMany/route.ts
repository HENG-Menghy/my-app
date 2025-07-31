// @/api/room/deleteMany/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import prisma from "@/lib/db/prisma";
import { BookingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function DELETE(request: NextRequest) {
  try {
    const validRoomIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const ids = await validateRequest(validRoomIds, body);

    // Fetch rooms including bookings and names
    const roomsToProcess = await prisma.room.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        floorId: true,
        bookings: { select: { id: true, status: true, } },
      },
    });

    if (roomsToProcess.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          message: "None of the provided room ID(s) exist" 
        },
        { status: 400 }
      );
    }

    // Validate provided room ids with existing rooms
    const existingRooms = await prisma.room.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (existingRooms.length !== ids.length) {
      return NextResponse.json(
        { 
          success: false,
          message: "Some provided room ID(s) do not exist" 
        },
        { status: 400 }
      );
    }

    const deletableRooms = roomsToProcess.filter(
      (room) => room.bookings.every(
        (booking) => booking.status !== BookingStatus.approved
      )
    );
    const blockedRooms = roomsToProcess.filter(
      (room) => room.bookings.some(
        (booking) => booking.status === BookingStatus.approved
      )
    ).map(r => r.name);

    const deletedRoomIds = deletableRooms.map((room) => room.id);
    const deletedRoomNames = deletableRooms.map((room) => room.name);

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

    return ApiResponse.success(
      {
        message: "Successfully processed bulk deletion of rooms",
        data: { 
          deletedRooms: deletedRoomNames,
          skippedRooms: blockedRooms,
        },
      },
    );
  } catch (error) {
    console.error("Error during bulk deletion:", error);
    return ApiResponse.error(error);
  }
}