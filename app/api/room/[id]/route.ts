// @/api/room/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { fromUTCToLocal } from "@/utils/datetime";
import { normalizeName } from "@/utils/normalizeName";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { BookingStatus, UserRole } from "@prisma/client";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { AvailableHours } from "@/lib/validations/availableHoursSchema";

// GET Single Room
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        floorId: true,
        imageUrl: true,
        name: true,
        type: true,
        status: true,
        capacity: true,
        amenities: true,
        availableHours: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        floor: {
          include: {
            building: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        {
          success: false,
          message: "Room not found",
        },
        { status: 404 }
      );
    }

    return ApiResponse.success({
      message: `Successfully get room ‘${room.name}’ on ‘${room.floor.label}’ of building ‘${room.floor.building.name}’`,
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
        floor: {
          ...room.floor,
          createdAt: fromUTCToLocal(room.floor.createdAt).toFormat(
            "yyyy-LLL-dd hh:mm:ss a"
          ),
          updatedAt: fromUTCToLocal(room.floor.updatedAt).toFormat(
            "yyyy-LLL-dd hh:mm:ss a"
          ),
          building: {
            ...room.floor.building,
            createdAt: fromUTCToLocal(room.floor.building.createdAt).toFormat(
              "yyyy-LLL-dd hh:mm:ss a"
            ),
            updatedAt: fromUTCToLocal(room.floor.building.updatedAt).toFormat(
              "yyyy-LLL-dd hh:mm:ss a"
            ),
          },
        },
      },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

// DELETE Room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        floorId: true,
        name: true,
        bookings: { select: { id: true, status: true } },
      },
    });
    if (!room) {
      return NextResponse.json(
        {
          success: false,
          message: "Room does not exist",
        },
        { status: 404 }
      );
    }
    if (room.bookings.some((b) => b.status === BookingStatus.approved)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete room ${room.name}; it contains approved bookings`,
        },
        { status: 400 }
      );
    }

    const floor = await prisma.floor.findUnique({
      where: { id: room?.floorId },
      select: { buildingId: true },
    });

    await prisma.room.delete({ where: { id: id } });

    const roomCountOnFloor = await prisma.room.count({
      where: { floor: { id: room?.floorId } },
    });
    const roomCountInBuilding = await prisma.room.count({
      where: { floor: { buildingId: floor?.buildingId } },
    });

    await Promise.all([
      prisma.floor.update({
        where: { id: room?.floorId },
        data: { totalRooms: roomCountOnFloor },
      }),
      prisma.building.update({
        where: { id: floor?.buildingId },
        data: { totalRooms: roomCountInBuilding },
      }),
    ]);

    return ApiResponse.success({
      message: `Room ‘${room.name}’ was deleted successfully`,
      data: { deletedRoom: { id: id, name: room.name } },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

// Update Room
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const { id } = await params;
    const body = await request.json();
    const roomData = await validateRequest(RoomUpdateSchema, body);
    const { name, floorId, availableHours } = roomData;

    // Fetch current room details.
    const existingRoom = await prisma.room.findUnique({
      where: { id },
      select: { id: true, floorId: true, name: true },
    });
    if (!existingRoom) {
      return NextResponse.json(
        {
          success: false,
          message: "Room not found",
        },
        { status: 404 }
      );
    }

    const oldFloorId = existingRoom.floorId;
    const newFloorId = floorId ? floorId : oldFloorId;
    const floorChanged = newFloorId !== oldFloorId;

    // -- Handle moving room to new floor --
    let floorNumber, buildingName;
    if (floorChanged) {
      const newFloor = await prisma.floor.findUnique({
        where: { id: newFloorId },
        select: { buildingId: true, floorNumber: true },
      });
      if (!newFloor) {
        return NextResponse.json(
          {
            success: false,
            message: "The new floor does not exist",
          },
          { status: 400 }
        );
      }
      const building = await prisma.building.findUnique({
        where: { id: newFloor.buildingId },
        select: { name: true },
      });

      floorNumber = newFloor.floorNumber;
      buildingName = building?.name;
      roomData.floorId = newFloorId;
    }

    // --- Handle Name Update ---
    if (typeof name === "string" && name.trim() !== "") {
      const cleanedName = normalizeName(name);
      if (cleanedName !== existingRoom.name) {
        const duplicateRoom = await prisma.room.findFirst({
          where: {
            name: { equals: cleanedName, mode: "insensitive" },
            NOT: { id },
          },
        });
        if (duplicateRoom) {
          return NextResponse.json(
            {
              success: false,
              message: `Cannot change name to '${cleanedName}': It already exists`,
            },
            { status: 400 }
          );
        }
      }
      roomData.name = cleanedName;
    }

    if (availableHours && availableHours?.length > 0) {
      // Create a map from existing for faster look up
      const hoursMap = new Map<string, any>();
      const room = await prisma.room.findUnique({ where: { id } });
      const oldAvailableHours = room?.availableHours as AvailableHours;
      for (const entry of oldAvailableHours) {
        if (entry?.dayOfWeek) {
          hoursMap.set(entry.dayOfWeek.toLocaleLowerCase(), entry);
        }
      }

      // Apply overrides
      for (const override of availableHours) {
        const day = override.dayOfWeek.toLocaleLowerCase();
        const existing = hoursMap.get(day);
        hoursMap.set(
          day,
          existing ? { ...existing, ...override } : { ...override }
        );
      }
      roomData.availableHours = Array.from(hoursMap.values());
    }

    const updatedRoom = await prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id },
        data: roomData,
      });

      // Return updated room with fresh availabileHours
      return tx.room.findUnique({
        where: { id },
        select: {
          id: true,
          floorId: true,
          imageUrl: true,
          name: true,
          type: true,
          status: true,
          capacity: true,
          amenities: true,
          availableHours: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    // Helper function to update counts
    const updateCountsForFloor = async (floorId: string) => {
      const roomCountOnFloor = await prisma.room.count({ where: { floorId } });
      await prisma.floor.update({
        where: { id: floorId },
        data: { totalRooms: roomCountOnFloor },
      });
      const floorData = await prisma.floor.findUnique({
        where: { id: floorId },
        select: { buildingId: true },
      });
      if (!floorData?.buildingId) return;
      const floors = await prisma.floor.findMany({
        where: { buildingId: floorData.buildingId },
        select: { id: true },
      });
      const allFloorIds = floors.map((f) => f.id);
      const roomCountInBuilding = await prisma.room.count({
        where: { floorId: { in: allFloorIds } },
      });
      await prisma.building.update({
        where: { id: floorData.buildingId },
        data: { totalRooms: roomCountInBuilding },
      });
    };

    // Update counts on destination floor
    await updateCountsForFloor(newFloorId);
    // If moved, update old floor counts
    if (floorChanged) {
      await updateCountsForFloor(oldFloorId);
    }

    return ApiResponse.success({
      message: `${
        floorChanged
          ? `Successfully moved room ‘${existingRoom.name}’ to floor ‘${floorNumber}’ of building ‘${buildingName}’`
          : `Room ‘${existingRoom.name}’ was updated successfully`
      }`,
      data: {
        ...updatedRoom,
        availableHours: sortAvailableHours(
          updatedRoom!.availableHours as {
            dayOfWeek: string;
            startTime: string;
            endTime: string;
          }[]
        ),
        createdAt: fromUTCToLocal(updatedRoom!.createdAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
        updatedAt: fromUTCToLocal(updatedRoom!.updatedAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
      },
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
