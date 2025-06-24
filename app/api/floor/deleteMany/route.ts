// @/api/floor/deleteMany/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const floorIds: string[] = body.id;

    if (!floorIds || !Array.isArray(floorIds) || floorIds.length === 0) {
      return NextResponse.json(
        { error: "No floor IDs provided" },
        { status: 400 }
      );
    }

    // Validate each floor ID using Zod
    const idSchema = z.string().uuid();
    for (const id of floorIds) {
      const result = idSchema.safeParse(id);
      if (!result.success) {
        return NextResponse.json(
          { error: `Invalid floor ID: ${id}` },
          { status: 400 }
        );
      }
    }

    // Fetch floors with their building and room details (including bookings)
    const matchedFloors = await prisma.floor.findMany({
      where: { id: { in: floorIds } },
      select: {
        id: true,
        buildingId: true,
        floorNumber: true,
        rooms: { select: { id: true, bookings: { select: { id: true } } } },
      },
    });

    if (matchedFloors.length !== floorIds.length) {
      return NextResponse.json(
        { error: "Some floor IDs do not exist" },
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
        { error: "All floors must belong to the same building" },
        { status: 400 }
      );
    }

    // Delete the specified floors
    await prisma.floor.deleteMany({ where: { id: { in: floorIds } } });

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
    await prisma.building.update({
      where: { id: buildingId },
      data: {
        totalFloors: newTotalNumberedFloors,
        totalRooms: newTotalRooms,
        hasGroundFloor: groundFloorExists,
      },
    });

    return NextResponse.json(
      {
        message: `${floorIds.length} floors were deleted successfully`,
        deletedIds: floorIds,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Many floors deletion error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
