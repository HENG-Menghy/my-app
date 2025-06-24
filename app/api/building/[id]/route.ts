// @/api/building/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { BuildingUpdateSchema } from "@/lib/validations/building";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay } from "@/utils/datetime";
import { HandleZodError } from "@/utils/validationError";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { normalizeName } from "@/utils/normalizeName";

// Get building
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        floors: {
          include: {
            rooms: {
              select: { id: true },
              orderBy: { name: "asc" },
            },
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

    return NextResponse.json(FormattedDateDisplay(building), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching building:", error);
    return NextResponse.json(
      { error: "Failed to fetch building" },
      { status: 500 }
    );
  }
}

// Delete building
export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Find the building and related floors and rooms
    const building = await prisma.building.findUnique({
      where: { id },
      select: { id: true },
    });

    // Check if the building exists
    if (!building) {
      return NextResponse.json(
        { error: "Building not found" },
        { status: 404 }
      );
    }

    // Perform deleting building
    await prisma.building.delete({ where: { id } });

    return NextResponse.json(
      { message: "Building was successfully deleted", deletedId: id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting building: ", error);
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
  try {
    const { id } = params;
    const body = await request.json();
    const data = BuildingUpdateSchema.parse(body);
    const { name, address, totalFloors, hasGroundFloor } = data;

    const existingBuilding = await prisma.building.findUnique({
      where: { id },
      include: {
        floors: {
          include: {
            rooms: {
              select: {
                name: true,
                bookings: { select: { id: true } },
              },
            },
          },
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

    // Helper to clean text
    const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();
    const titleCasedName = name ? normalizeName(name) : undefined;
    const cleanedAddress = address ? cleanText(address) : undefined;

    // Check duplicate building name (if updated)
    if (titleCasedName) {
      const existingName = await prisma.building.findFirst({
        where: {
          name: { equals: titleCasedName, mode: "insensitive" },
          NOT: { id },
        },
      });
      if (existingName) {
        return NextResponse.json(
          {
            error: `Cannot update to name '${titleCasedName}': It already exists`,
          },
          { status: 400 }
        );
      }
    }

    // Use effectiveHasGroundFloor: if not provided in the update payload, default to the existing building value
    const effectiveHasGroundFloor =
      typeof hasGroundFloor === "boolean"
        ? hasGroundFloor
        : existingBuilding.hasGroundFloor;

    // Start transaction for floor adjustments and building update
    const updatedBuilding = await prisma.$transaction(async (tx) => {
      // ─── Ground Floor Addition/Removal ───
      if (
        typeof hasGroundFloor === "boolean" &&
        hasGroundFloor !== existingBuilding.hasGroundFloor
      ) {
        if (hasGroundFloor) {
          // Add ground floor (floorNumber 0) if not present
          const groundFloorExists = existingBuilding.floors.some(
            (f) => f.floorNumber === 0
          );
          if (!groundFloorExists) {
            await tx.floor.create({
              data: { buildingId: id, floorNumber: 0, label: getFloorLabel(0) },
            });
          }
        } else {
          // Remove ground floor if exists
          const groundFloor = existingBuilding.floors.find(
            (f) => f.floorNumber === 0
          );
          if (groundFloor) {
            const roomWithBookings = groundFloor.rooms
              .filter((room) => room.bookings.length > 0)
              .map((room) => room.name);

            if (roomWithBookings.length > 0) {
              return NextResponse.json(
                {
                  error:
                    "Cannot remove ground floor; some rooms contain bookings",
                  roomWithBookings,
                },
                { status: 400 }
              );
            }

            await tx.floor.delete({ where: { id: groundFloor.id } });
          }
        }
      }

      // ─── Floor Adjustments Based on totalFloors ───
      // totalFloors from the payload represents solely the numbered floors (1 .. totalFloors)
      // If effectiveHasGroundFloor is true, allowed floors in the DB = totalFloors + 1 (including floor 0)
      const allowedCount = effectiveHasGroundFloor
        ? totalFloors! + 1
        : totalFloors;

      // Re-read floors after any ground floor modifications.
      const currentFloors = await tx.floor.findMany({
        where: { buildingId: id },
        select: { floorNumber: true, id: true },
      });
      const currentCount = currentFloors.length;

      if (currentCount < allowedCount!) {
        // Add missing floors.
        const missingCount = allowedCount! - currentCount;
        const existingFloorNumbers = new Set(
          currentFloors.map((f) => f.floorNumber)
        );
        // Determine highest floor number. If none exists, default based on effectiveHasGroundFloor
        const highestExistingFloor =
          existingFloorNumbers.size > 0
            ? Math.max(...Array.from(existingFloorNumbers))
            : effectiveHasGroundFloor
            ? 0
            : 1;
        const newFloors = Array.from({ length: missingCount }).map((_, idx) => {
          const newFloorNumber = highestExistingFloor + idx + 1;
          return {
            buildingId: id,
            floorNumber: newFloorNumber,
            label: getFloorLabel(newFloorNumber),
          };
        });
        await tx.floor.createMany({ data: newFloors });
      } else if (currentCount > allowedCount!) {
        // Remove any excess floors.
        // Only numbered floors beyond the allowed range should be removed.
        // (Ground floor is floor 0 and should never be removed when effectiveHasGroundFloor is true.)
        const excessFloors = existingBuilding.floors
          .filter((floor) => floor.floorNumber > totalFloors!) // floors with floorNumber greater than totalFloors are deemed excess
          .filter((floor) =>
            floor.rooms.every((room) => room.bookings.length === 0)
          );
        if (excessFloors.length > 0) {
          const excessIds = excessFloors.map((floor) => floor.id);
          await tx.floor.deleteMany({ where: { id: { in: excessIds } } });
        } else {
          const blockedRooms = existingBuilding.floors
            .filter((floor) => floor.floorNumber > totalFloors!)
            .flatMap((floor) =>
              floor.rooms.filter((room) => room.bookings.length > 0)
            )
            .map((room) => room.name);

          return NextResponse.json(
            {
              error:
                "Cannot reduce floor count; the following rooms have active bookings",
              blockedRooms,
            },
            { status: 400 }
          );
        }
      }

      // ─── Recalculate Building Totals ───
      // Retrieve the current list of floors in this building.
      const floorsAfter = await tx.floor.findMany({
        where: { buildingId: id },
        select: { id: true, floorNumber: true },
      });
      const floorIds = floorsAfter.map((f) => f.id);

      // Count only rooms associated with these floors.
      const roomCount = await tx.room.count({
        where: { floorId: { in: floorIds } },
      });

      // totalFloors in the building model is meant to represent only numbered floors (not including the ground floor).
      // If effectiveHasGroundFloor is true, subtract one from the total floor count.
      const newTotalNumberedFloors = effectiveHasGroundFloor
        ? floorsAfter.length - 1
        : floorsAfter.length;

      // Update the building record with recalculated totals as well as any updated fields (name, address, etc.)
      return await tx.building.update({
        where: { id },
        data: {
          ...data, // includes totalFloors (but we'll override it)
          ...(titleCasedName && { name: titleCasedName }),
          ...(cleanedAddress && { address: cleanedAddress }),
          totalFloors: newTotalNumberedFloors,
          totalRooms: roomCount,
          hasGroundFloor: effectiveHasGroundFloor,
        },
      });
    });

    return NextResponse.json(
      {
        message: "Building was successfully updated",
        updatedBuilding: FormattedDateDisplay(updatedBuilding),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error updating building:", error);
    return HandleZodError(error);
  }
}
