// @/api/floor/route.ts

import prisma from "@/lib/db/prisma";
import { FormattedDateDisplay } from "@/utils/datetime";
import { FloorSchema } from "@/lib/validations/floor";
import { NextRequest, NextResponse } from "next/server";
import { getRoomName } from "@/utils/generateRoomName";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { z } from "zod";
import { normalizeName } from "@/utils/normalizeName";
import { UserRole } from "@prisma/client";
import { validateRequest } from "@/lib/api/validate";
import { ApiResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";

// CREATE new floor
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
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
          message: "Building not found",
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
          message: `Floor ${floorNumber} already exists in building ‘${existingBuilding.name}’`,
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
            message: `Floor name ‘${name.trim()}’ already exists`,
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
      }

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

    return ApiResponse.success({
      message: `Successfully created floor ‘${result.floorNumber}’ in building ‘${existingBuilding.name}’`,
      data: FormattedDateDisplay(result),
      status: 201,
    });
  } catch (error: unknown) {
    return ApiResponse.error(error);
  }
}

/*
  GET all floors
  Retrieve floors by building, and ordering by floor number
*/
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();

    const searchParams = request.nextUrl.searchParams;
    const buildingIdParam = searchParams.get("buildingId");
    if (!buildingIdParam) {
      return NextResponse.json(
        {
          success: false,
          message: "Floors must belong to specific building; no any building was provided",
        },
        { status: 400 },
      );
    }

    const validBuildingId = z.string().uuid();
    const buildingId = await validateRequest(validBuildingId, buildingIdParam);

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true },
    });
    const buildingName = building!.name;
    const floors = await prisma.floor.findMany({
      where: { buildingId },
      orderBy: { floorNumber: "asc" },
    });

    return ApiResponse.success({
      message: `Successfully get all floors belong to building ‘${buildingName}’`,
      data: FormattedDateDisplay(floors),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}