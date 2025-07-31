// @/api/floor/deleteMany/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import prisma from "@/lib/db/prisma";
import { BookingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Bulk-deleting floors
export async function DELETE(request: NextRequest) {
  try {
    const validFloorIds = z.array(z.string().uuid()).nonempty();
    const body = await request.json();
    const floorIds = await validateRequest(validFloorIds, body);

    // Fetch floors with their building and room details (including bookings)
    const matchedFloors = await prisma.floor.findMany({
      where: { id: { in: floorIds } },
      select: {
        id: true,
        buildingId: true,
        label: true,
        rooms: { 
          select: { 
            id: true, 
            name: true,
            bookings: { 
              select: { 
                id: true, 
                status: true, 
              }, 
            },
          }, 
        },
      },
    });

    // Ensure that all of the provided floor IDs match the existing floors
    if (matchedFloors.length !== floorIds.length) {
      return NextResponse.json(
        { 
          success: false,
          message: "Some floor ID(s) do not exist" ,
        },
        { status: 400 }
      );
    }

    // Ensure that all floors belong to the same building
    const buildingId = matchedFloors[0].buildingId;
    const sameBuilding = matchedFloors.every(
      (floor) => floor.buildingId === buildingId
    );
    if (!sameBuilding) {
      return NextResponse.json(
        { 
          success: false,
          message: "All floors must belong to the same building" ,
        },
        { status: 400 }
      );
    }

    // Perform deletion of the specified floors with guard check
    if (matchedFloors.length === floorIds.length) {
      const deletableFloors = matchedFloors.filter(
        (floor) => floor.rooms.every(
          (room) => room.bookings.every(
            (booking) => booking.status !== BookingStatus.approved
          )
        )
      );

      if (deletableFloors.length > 0) {
        await prisma.floor.deleteMany({ where: { id: { in: floorIds } } });
      } else {
        const blockedRooms: string[] = matchedFloors.flatMap(
          (floor) => floor.rooms.filter(
            (room) => room.bookings.some(
              (booking) => booking.status === BookingStatus.approved
            )
          )
        ).map(room => room.name);
        
        if (blockedRooms.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot bulk delete floors because some rooms on the floors have approved bookings",
              roomsWithActiveBookings: blockedRooms,
            },
            { status: 400 },
          );
        }
      }
    }

    // Recalculate building totals.
    // Retrieve all the remaining floors of this building WITH their floorNumber.
    const remainingFloors = await prisma.floor.findMany({
      where: { buildingId },
      select: { id: true, floorNumber: true },
    });

    // Count numbered floors (those with floorNumber > 0).
    const newTotalNumberedFloors = remainingFloors.filter(
      (f) => f.floorNumber > 0
    ).length;

    // Determine ground floor existence.
    const groundFloorExists = remainingFloors.some((f) => f.floorNumber === 0);

    // Count all rooms in remaining floors.
    const remainingFloorIds = remainingFloors.map((f) => f.id);
    const newTotalRooms = await prisma.room.count({
      where: { floorId: { in: remainingFloorIds } },
    });

    // Update the building totals. Note: building.totalFloors represents numbered floors only.
    const building = await prisma.building.update({
      where: { id: buildingId },
      data: {
        totalFloors: newTotalNumberedFloors,
        totalRooms: newTotalRooms,
        hasGroundFloor: groundFloorExists,
      },
    });

    return ApiResponse.success(
      {
        message: `${floorIds.length} floor(s) belong to building ${building.name} were deleted successfully`,
        data: { 
          "deletedFloor(s)": matchedFloors.map(f => f.label) 
        },
      },
    );
  } catch (err) {
    console.error("Many floors deletion error:", err);
    return ApiResponse.error(err);
  }
}