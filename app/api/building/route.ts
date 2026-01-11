// @/api/building/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay } from "@/utils/datetime";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { normalizeName } from "@/utils/normalizeName";
import { getRoomName } from "@/utils/generateRoomName";
import { BuildingSchema } from "@/lib/validations/building";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { UserRole } from "@prisma/client";

// Create building
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const body = await request.json();
    const data = await validateRequest(BuildingSchema, body);
    const {
      name,
      address,
      location,
      totalFloors,
      totalRoomsOnEachFloor,
      hasGroundFloor,
      description,
      RoomsImage,
      RoomsCapacities,
      RoomsAmenities,
      RoomsAvailableHours,
    } = data;

    // Normalize building name and address
    const titleCaseName = normalizeName(name);
    const cleanAddress = address.replace(/\s+/g, " ").trim();

    // Check for duplicate building name (case-insensitive)
    const existingName = await prisma.building.findFirst({
      where: {
        name: {
          equals: titleCaseName,
          mode: "insensitive",
        },
      },
    });

    if (existingName) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot create building with name '${titleCaseName}': It already exists`,
        },
        { status: 400 }
      );
    }

    const building = await prisma.$transaction(async (tx) => {
      // Create building
      const building = await tx.building.create({
        data: {
          name: titleCaseName,
          address: cleanAddress,
          location,
          totalFloors,
          hasGroundFloor,
          description,
        },
      });

      // Determine the starting floor number
      const startingFloor = hasGroundFloor ? 0 : 1;
      const totalFloorCount = hasGroundFloor ? totalFloors + 1 : totalFloors;

      // Auto-generate floor data based on the total number of floors
      const floorData = Array.from({ length: totalFloorCount }).map((_, i) => ({
        buildingId: building.id,
        floorNumber: startingFloor + i,
        totalRooms: totalRoomsOnEachFloor,
        label: getFloorLabel(startingFloor + i),
      }));

      // Create floors for the building
      await tx.floor.createMany({ data: floorData });
      const createdFloors = await tx.floor.findMany({
        where: { buildingId: building.id },
      });
      // Update totalRooms for building
      await tx.building.update({
        where: { id: building.id },
        data: { totalRooms: createdFloors.length * totalRoomsOnEachFloor },
      });

      // Auto-generate rooms
      await Promise.all(
        createdFloors.flatMap((floor) =>
          Array.from({ length: totalRoomsOnEachFloor }).map((_, i) =>
            tx.room.create({
              data: {
                floorId: floor.id,
                name: getRoomName(building.name, floor.floorNumber, i),
                imageUrl: RoomsImage,
                capacity: RoomsCapacities,
                amenities: RoomsAmenities,
                availableHours: RoomsAvailableHours,
              },
            })
          )
        )
      );

      // Re-fetch building with updated totalRooms
      const updateBuilding = await tx.building.findUnique({
        where: { id: building.id },
      });

      return updateBuilding;
    });

    return ApiResponse.success({
      message: `Building ‘${building!.name}’ was created successfully`,
      data: FormattedDateDisplay(building),
      status: 201,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}

// Get all buildings
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
    const buildings = await prisma.building.findMany({
      orderBy: { name: "asc" },
    });
    return ApiResponse.success({
      message: "Successfully get all buildings",
      data: FormattedDateDisplay(buildings),
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
