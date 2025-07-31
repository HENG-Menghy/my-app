// @/api/floor/route.ts

import prisma from "@/lib/db/prisma";
import { FormattedDateDisplay } from "@/utils/datetime";
import { FloorSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { getRoomName } from "@/utils/generateRoomName";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { z } from "zod";
import { normalizeName } from "@/utils/normalizeName";
import { Floor } from "@prisma/client";
import { validateRequest } from "@/lib/api/validate";
import { ApiResponse } from "@/lib/api/response";

// CREATE new floor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await validateRequest(FloorSchema, body);
    const { 
      buildingId, 
      name, 
      floorNumber, 
      totalRooms,
      description,
      RoomsImage,
      RoomsCapacities,
      RoomsAmenities,
      RoomsAvailableHours,
    } = data;

    // Check if building exists
    const existingBuilding = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true, totalRooms: true, hasGroundFloor: true },
    });

    if (!existingBuilding) {
      return NextResponse.json(
        { 
          success: false,
          message: "Building not found" 
        },
        { status: 404 }
      );
    }

    // Check if the floor number already exists within the building
    const existingFloor = await prisma.floor.findFirst({
      where: { buildingId, floorNumber },
    });

    if (existingFloor) {
      return NextResponse.json(
        { 
          success: false,
          message: `Floor ${floorNumber} already exists in building ${existingBuilding.name}` 
        },
        { status: 400 }
      );
    }

    // Check for existing floor name conflict
    if (name && name.trim() !== "") {
      const cleanName = normalizeName(name);
      const existingName = await prisma.floor.findFirst({
        where: {
          name: {
            equals: cleanName,
            mode: "insensitive",
          },
        },
      });

      if (existingName) {
        return NextResponse.json(
          { 
            success: false,
            message: `Floor name '${name.trim()}' already exists` 
          },
          { status: 400 }
        );
      }
      data.name = cleanName;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the floor with an appropriate label
      const createdFloor = await tx.floor.create({
        data: {
          buildingId,
          name,
          floorNumber,
          totalRooms,
          label: getFloorLabel(floorNumber),
          description,
        },
      });

      for (let i = 0; i < totalRooms; i++) {
        const roomName = getRoomName(existingBuilding.name, floorNumber, i);

        // Create rooms one-by-one so we can use returned room IDs
        await tx.room.create({
          data: {
            name: roomName,
            floorId: createdFloor.id,
            imageUrl: RoomsImage,
            capacity: RoomsCapacities,
            amenities: RoomsAmenities,
            availableHours: RoomsAvailableHours,
          },
        });
      };

      // Get all floors for the building (their IDs and floorNumbers)
      const floors = await tx.floor.findMany({
        where: { buildingId },
        select: { id: true },
      });
      const floorIds = floors.map((f) => f.id);

      // Count all rooms on these floors.
      const roomCount = await tx.room.count({
        where: { floorId: { in: floorIds } },
      });

      // Update the building record
      // totalFloors represents only numbered floors (e.g. floors 1 to n).
      const floorCount = floors.length;
      const newTotalFloors =
        existingBuilding.hasGroundFloor || floorNumber === 0
          ? floorCount - 1
          : floorCount;
      await tx.building.update({
        where: { id: buildingId },
        data: {
          totalFloors: newTotalFloors,
          totalRooms: roomCount,
          ...(floorNumber === 0 && { hasGroundFloor: true }),
        },
      });

      return createdFloor;
    });

    return ApiResponse.success(
      {
        message: `Successfully create floor ${result.floorNumber} in building ${existingBuilding.name}`,
        data: FormattedDateDisplay(result),
      },
    );
  } catch (error: unknown) {
    console.log("Create floor error: ", error);
    return ApiResponse.error(error);
  }
}

/*
  GET all floors
  Retrieve floors by building/all, and ordering by floor number
*/
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingIdParam = searchParams.get("buildingId");
    const validBuildingId = z.string().uuid();
    const buildingId = await validateRequest(validBuildingId, buildingIdParam)
    
    let floors = [] as Floor[];
    let buildingName: string = "";
    if (buildingId) {
      const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { name: true },
      });
      if (!building) {
        return NextResponse.json(
          { 
            success: false,
            message: "The provided buildingId param does not exist for any building"  
          },
          { status: 400 },
        )
      }
      buildingName = building.name;
      floors = await prisma.floor.findMany({
        where: { buildingId },
        orderBy: { floorNumber: "asc" },
      });
    } else {
      floors = await prisma.floor.findMany({
        orderBy: [{ buildingId: "asc" }, { floorNumber: "asc" }],
      });
    }
    return ApiResponse.success(
      {
        message: `Successfully get all floors${buildingId ? ` belong to building ${buildingName}` : ""}`,
        data: FormattedDateDisplay(floors),
      }, 
    );
  } catch (error) {
    console.error("Error fetching floors:", error);
    return ApiResponse.error(error);
  }
}

/*
  DELETE all floors belong to building
*/
export async function DELETE(request: NextRequest) {
  try {
    const validBuildingId = z.string().uuid();
    const body = await request.json();
    const buildingId = await validateRequest(validBuildingId, body);

    // Ensure the building exists.
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      return NextResponse.json(
        { 
          success: false,
          message: "Building not found" 
        },
        { status: 404 }
      );
    }

    // Delete all floors for the building
    await prisma.floor.deleteMany({
      where: { buildingId },
    });

    // After deletion, update the building's totals.
    // Now there should be no floors, so totalFloors = 0; and similarly, no rooms exist.
    await prisma.building.update({
      where: { id: buildingId },
      data: { totalFloors: 0, totalRooms: 0, hasGroundFloor: false },
    });

    // Return the remaining floors (should be an empty list)
    const remainingFloors = await prisma.floor.findMany({
      where: { buildingId },
    });

    return ApiResponse.success(
      {
        message: `All floors belonging to building ${building.name} were successfully deleted`,
        data: remainingFloors,
      },
    );
  } catch (error) {
    console.error("Error deleting floors:", error);
    return ApiResponse.error(error);
  }
}