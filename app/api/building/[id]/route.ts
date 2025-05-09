// @/api/building/[id]/route.ts

import { BuildingUpdateSchema } from "@/lib/validations/building";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { convertDatesToPhnomPenhTimezone } from "@/lib/convertTimestamps";
import { HandleZodError } from "@/lib/validationError";
import { getFloorLabel } from "@/lib/generateFloorLabel";
import { toTitleCase } from "@/app/lib/getTitleCase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        floors: {
          select: {
            id: true,
            floorNumber: true,
            totalRooms: true,
            label: true,
            rooms: { select: { id: true } },
          },
          orderBy: { floorNumber: "asc" },
        },
      },
    });

    if (!building) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { building: convertDatesToPhnomPenhTimezone(building) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching building:", error);
    return NextResponse.json(
      { error: "Failed to fetch building" },
      { status: 500 }
    );
  }
}

// Delete building by id with guard check
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const building = await prisma.building.findUnique({
      where: { id },
      select: {
        id: true,
        floors: { select: { id: true } },
      },
    });

    if (!building)
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );

    // Check if the building has floors
    if (building.floors.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete building. It contains floors" },
        { status: 400 }
      );
    }

    // Proceed with deletion
    await prisma.building.delete({ where: { id } });
    return NextResponse.json(
      { message: "Building was successfully deleted", deletedId: id },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error deleting building: ", error);
    return NextResponse.json(
      { error: "Failed to delete building" },
      { status: 500 }
    );
  }
}

// Update building
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const body = await request.json();
    const data = BuildingUpdateSchema.parse(body);
    const { name, totalFloors, hasGroundFloor } = data;
    const existingBuilding = await prisma.building.findUnique({
      where: { id },
      include: {
        floors: {
          include: { rooms: true },
          orderBy: { floorNumber: "asc" },
        },
      },
    });

    if (!existingBuilding) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    // Ensure no room exists on any floor if floor layout needs update
    const hasRoomOnAnyFloor = existingBuilding.floors.some(
      (f) => f.rooms.length > 0
    );

    const titleCasedName = name ? toTitleCase(name) : undefined;
    if (titleCasedName) {
      const existingName = await prisma.building.findFirst({
        where: {
          name: {
            equals: titleCasedName,
            mode: "insensitive",
          },
          NOT: { id },
        },
      });

      if (existingName) {
        return NextResponse.json(
          { error: `Cannot update to name '${titleCasedName}': It already exists` },
          { status: 400 }
        );
      }
    }

    // Check if totalFloors or hasGroundFloor has changed
    if (
      (typeof totalFloors === "number" &&
        totalFloors !== existingBuilding.totalFloors) ||
      (typeof hasGroundFloor === "boolean" &&
        hasGroundFloor !== existingBuilding.hasGroundFloor)
    ) {
      // Prevent changes if any floor has rooms
      if (hasRoomOnAnyFloor) {
        return NextResponse.json(
          { error: "Cannot change totalFloors or hasGroundFloor because some floors have rooms" },
          { status: 400 }
        );
      }

      // Determine the final configuration (default to current if not provided)
      const finalHasGround = hasGroundFloor ?? existingBuilding.hasGroundFloor;
      const finalTotalFloors = totalFloors ?? existingBuilding.totalFloors;

      // Delete all existing floors first
      await prisma.floor.deleteMany({ where: { buildingId: id } });
      
      // Wrap the floor update in a transaction (delete and re-create floors)
      await prisma.$transaction(async (tx) => {
        await tx.floor.deleteMany({ where: { buildingId: id } });

        const floorData = Array.from({ length: finalTotalFloors }).map((_, i) => {
          // Calculate floor number based on whether there's a ground floor
          const floorNumber = finalHasGround ? i : i + 1;
          return {
            buildingId: id,
            floorNumber,
            label: getFloorLabel(floorNumber),
          };
        });

        // Create new floors
        for (const floor of floorData) {
          await tx.floor.create({ data: floor });
        }
      });

      data.totalFloors = finalTotalFloors;
      data.hasGroundFloor = finalHasGround;
    }

    const updatedBuilding = await prisma.building.update({
      where: { id },
      data: {
        ...data,
        ...(titleCasedName && { name: titleCasedName }),
      },
    });

    return NextResponse.json(
      {
        message: "Building was successfully updated",
        building: convertDatesToPhnomPenhTimezone(updatedBuilding),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error updating building:", error);
    return HandleZodError(error);
  }
}
