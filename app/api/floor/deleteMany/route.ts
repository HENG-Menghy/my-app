// @/api/floor/deleteMany/route.ts

import { convertDatesToPhnomPenhTimezone } from "@/app/lib/convertTimestamps";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const floorIds: string[] = body.id;

    if (
      !floorIds ||
      !Array.isArray(floorIds) ||
      floorIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No floor IDs provided" },
        { status: 400 }
      );
    }

    // Validate each ID
    const idValidation = z.string().uuid();
    for (const id of floorIds) {
      const result = idValidation.safeParse(id);
      if (!result.success) {
        return NextResponse.json(
          { error: `Invalid floor ID: ${id}` },
          { status: 400 }
        );
      }
    }

    const MatchedFloors = await prisma.floor.findMany({
      where: { id: { in: floorIds } },
      select: {
        id: true,
        buildingId: true,
        rooms: { select: { id: true } },
      },
    });

    if (MatchedFloors.length !== floorIds.length) {
      return NextResponse.json(
        { error: "Some floor IDs do not exist" },
        { status: 400 }
      );
    }

    const buildingId = MatchedFloors[0].buildingId;
    const sameBuilding = MatchedFloors.every((f) => f.buildingId === buildingId);
    if (!sameBuilding) {
      return NextResponse.json(
        { error: "All floors must belong to the same building" },
        { status: 400 }
      );
    }

    const hasRooms = MatchedFloors.some((f) => f.rooms.length > 0);
    if (hasRooms) {
      return NextResponse.json(
        { error: "Some floors contain rooms" },
        { status: 400 }
      );
    }

    await prisma.floor.deleteMany({ where: { id: { in: floorIds } } });

    const newTotal = await prisma.floor.count({ where: { buildingId } });
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors: newTotal },
    });


    const floors = await prisma.floor.findMany();
    return NextResponse.json(
      { 
        message:`${floorIds.length} Floors deleted successfully`,
        floor: convertDatesToPhnomPenhTimezone(floors)
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
