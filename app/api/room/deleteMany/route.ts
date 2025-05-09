// @/api/room/deleteMany/route.ts

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    // The client should send an object with "ids": string[]
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No room IDs provided" },
        { status: 400 }
      );
    }

    // Retrieve the rooms to be deleted including their floorId.
    const roomsToDelete = await prisma.room.findMany({
      where: { id: { in: ids } },
      select: { id: true, floorId: true },
    });

    // Ensure all provided room IDs exist.
    if (roomsToDelete.length !== ids.length) {
      return NextResponse.json(
        { error: "Some room IDs do not exist" },
        { status: 400 }
      );
    }

    // Create a set of affected floor IDs.
    const uniqueFloorIds = [
      ...new Set(roomsToDelete.map((room) => room.floorId)),
    ];

    // (Optional) Fetch floor details so we can update the corresponding buildings.
    const floors = await prisma.floor.findMany({
      where: { id: { in: uniqueFloorIds } },
      select: { id: true, buildingId: true },
    });

    // Determine the set of affected building IDs.
    const uniqueBuildingIds = [...new Set(floors.map((floor) => floor.buildingId))];

    // Bulk delete the rooms.
    await prisma.room.deleteMany({ where: { id: { in: ids } } });

    // For each affected floor, recalculate the remaining number of rooms.
    const floorUpdatePromises = uniqueFloorIds.map(async (floorId) => {
      const roomCountOnFloor = await prisma.room.count({
        where: { floorId },
      });
      return prisma.floor.update({
        where: { id: floorId },
        data: { totalRooms: roomCountOnFloor },
      });
    });

    // For each affected building, recalculate the total number of rooms.
    const buildingUpdatePromises = uniqueBuildingIds.map(async (buildingId) => {
      const roomCountInBuilding = await prisma.room.count({
        where: { floor: { buildingId } },
      });
      return prisma.building.update({
        where: { id: buildingId },
        data: { totalRooms: roomCountInBuilding },
      });
    });

    // Wait for all updates to finish.
    await Promise.all([...floorUpdatePromises, ...buildingUpdatePromises]);

    return NextResponse.json(
      { message: "Rooms were deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during bulk deletion:", error);
    return NextResponse.json(
      { error: "Failed to delete rooms" },
      { status: 500 }
    );
  }
}
