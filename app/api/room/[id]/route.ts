// @/api/room/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { fromUTCToLocal, FormattedDateDisplay } from "@/utils/datetime";
import { normalizeName } from "@/utils/normalizeName";
import { getRoomName } from "@/utils/generateRoomName";
import { HandleZodError } from "@/utils/validationError";
import { Prisma } from "@prisma/client";
import { sortAvailabilityByDay } from "@/utils/sortAvailability";

// GET Single Room
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        floorId: true,
        imageUrl: true,
        name: true,
        type: true,
        status: true,
        capacity: true,
        amenities: true,
        availability: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
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
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ...room,
        availability: sortAvailabilityByDay(room.availability),
        createdAt: fromUTCToLocal(room.createdAt).toFormat(
          "yyyy LLL dd hh:mm:ss a"
        ),
        updatedAt: fromUTCToLocal(room.updatedAt).toFormat(
          "yyyy LLL dd hh:mm:ss a"
        ),
        floor: {
          ...room.floor,
          createdAt: fromUTCToLocal(room.floor.createdAt).toFormat(
            "yyyy LLL dd hh:mm:ss a"
          ),
          updatedAt: fromUTCToLocal(room.floor.updatedAt).toFormat(
            "yyyy LLL dd hh:mm:ss a"
          ),
          building: {
            ...room.floor.building,
            createdAt: fromUTCToLocal(room.floor.building.createdAt).toFormat(
              "yyyy LLL dd hh:mm:ss a"
            ),
            updatedAt: fromUTCToLocal(room.floor.building.updatedAt).toFormat(
              "yyyy LLL dd hh:mm:ss a"
            ),
          },
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
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
    const room = await prisma.room.findUnique({
      where: { id: params.id },
      select: { floorId: true, bookings: { select: { id: true } } },
    });
    if (!room) {
      return NextResponse.json(
        { error: "Room does not exist" },
        { status: 404 }
      );
    }
    if (room.bookings.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete room: it contain bookings" },
        { status: 400 }
      );
    }

    const floor = await prisma.floor.findUnique({
      where: { id: room?.floorId },
      select: { buildingId: true },
    });

    await prisma.room.delete({ where: { id: params.id } });

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

    return NextResponse.json(
      { message: "Room was deleted successfully", deletedId: params.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}

// Update Room
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const body = await request.json();
    const parsed = RoomUpdateSchema.parse(body);
    const { availability, ...roomData } = parsed;
    const { name, floorId } = roomData;

    // Fetch current room details.
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, floorId: true, name: true },
    });
    if (!existingRoom) {
      return NextResponse.json(
        { error: "Room does not exist" },
        { status: 400 }
      );
    }

    const oldFloorId = existingRoom.floorId;
    const newFloorId = floorId ? floorId : oldFloorId;
    const floorChanged = newFloorId !== oldFloorId;

    // --- Handle Name Update ---
    if (floorChanged) {
      // When moving floors:
      if (typeof name === "string" && name.trim() !== "") {
        const cleanedName = normalizeName(name);
        if (cleanedName !== existingRoom.name) {
          const duplicateRoom = await prisma.room.findFirst({
            where: {
              name: { equals: cleanedName, mode: "insensitive" },
              NOT: { id: roomId },
            },
          });
          if (duplicateRoom) {
            return NextResponse.json(
              {
                error: `Cannot change name to '${cleanedName}': It already exists`,
              },
              { status: 400 }
            );
          }
        }
        roomData.name = cleanedName;
      } else {
        // Generate default name for destination floor
        const newFloor = await prisma.floor.findUnique({
          where: { id: newFloorId },
          select: { buildingId: true, floorNumber: true },
        });
        if (!newFloor) {
          return NextResponse.json(
            { error: "The new floor does not exist" },
            { status: 400 }
          );
        }
        const newBuilding = await prisma.building.findUnique({
          where: { id: newFloor.buildingId },
          select: { name: true },
        });
        if (!newBuilding) {
          return NextResponse.json(
            { error: "Building for the new floor does not exist" },
            { status: 400 }
          );
        }
        // Count rooms on new floor excluding the moving room.
        const newRoomCount = await prisma.room.count({
          where: { floorId: newFloorId, id: { not: roomId } },
        });
        // Since getRoomName() adds one internally, pass newRoomCount (zero-based).
        roomData.name = getRoomName(
          newBuilding.name,
          newFloor.floorNumber,
          newRoomCount
        );
      }
    } else {
      // When not moving floors, handle manual name update
      if (typeof name === "string" && name.trim() !== "") {
        const cleanedName = normalizeName(name);
        if (cleanedName !== existingRoom.name) {
          const duplicateRoom = await prisma.room.findFirst({
            where: {
              name: { equals: cleanedName, mode: "insensitive" },
              NOT: { id: roomId },
            },
          });
          if (duplicateRoom) {
            return NextResponse.json(
              {
                error: `Cannot change name to '${cleanedName}': It already exists`,
              },
              { status: 400 }
            );
          }
        }
        roomData.name = cleanedName;
      }
    }
    // --- End Handle Name Update ---

    // Validate new floor if moving
    if (roomData.floorId && floorChanged) {
      const newFloor = await prisma.floor.findUnique({
        where: { id: newFloorId },
        select: { buildingId: true },
      });
      if (!newFloor) {
        return NextResponse.json(
          { error: "The new floor does not exist" },
          { status: 400 }
        );
      }
    }

    const updatedRoom = await prisma.$transaction(async (tx) => {
      const room = await tx.room.update({
        where: { id: roomId },
        data: roomData as Prisma.RoomUpdateInput,
        include: {
          availability: {
            select: {
              dayOfWeek: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      });

      if (availability && availability.length > 0) {
        for (const a of availability) {
          await tx.roomAvailability.upsert({
            where: {
              roomId_dayOfWeek: {
                roomId,
                dayOfWeek: a.dayOfWeek,
              },
            },
            update: {
              startTime: a.startTime,
              endTime: a.endTime,
              isAvailable: a.isAvailable ?? true,
            },
            create: {
              roomId,
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime,
              endTime: a.endTime,
              isAvailable: a.isAvailable ?? true,
            },
          });
        }
      }

      // Return updated room with fresh availability
      return tx.room.findUnique({
        where: { id: roomId },
        include: {
          availability: {
            select: {
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
            },
          },
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
    // If moved, update old floor counts and re-number its rooms
    if (floorChanged) {
      await updateCountsForFloor(oldFloorId);

      // Re-number rooms on the old floor.
      // Use a reliable order (assume a 'createdAt' field exists; otherwise adjust accordingly)
      const oldFloorRooms = await prisma.room.findMany({
        where: { floorId: oldFloorId },
        orderBy: { createdAt: "asc" },
      });
      const oldFloorData = await prisma.floor.findUnique({
        where: { id: oldFloorId },
        select: { buildingId: true, floorNumber: true },
      });
      if (oldFloorData) {
        // const oldBuilding = await prisma.building.findUnique({
        //   where: { id: oldFloorData.buildingId },
        //   select: { name: true },
        // });
        // It's common to use a similar query to find the building.
        const buildingData = await prisma.building.findUnique({
          where: { id: oldFloorData.buildingId },
          select: { name: true },
        });
        if (buildingData) {
          for (let i = 0; i < oldFloorRooms.length; i++) {
            // Pass zero-based index `i`. getRoomName adds one internally.
            const expectedName = getRoomName(
              buildingData.name,
              oldFloorData.floorNumber,
              i
            );
            if (oldFloorRooms[i].name !== expectedName) {
              await prisma.room.update({
                where: { id: oldFloorRooms[i].id },
                data: { name: expectedName },
              });
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        message: "Room was successfully updated",
        updatedRoom: {
          ...updatedRoom,
          availability: sortAvailabilityByDay(updatedRoom!.availability),
          createdAt: fromUTCToLocal(updatedRoom!.createdAt).toFormat(
            "yyyy LLL dd hh:mm:ss a"
          ),
          updatedAt: fromUTCToLocal(updatedRoom!.updatedAt).toFormat(
            "yyyy LLL dd hh:mm:ss a"
          ),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating room:", error);
    return HandleZodError(error);
  }
}