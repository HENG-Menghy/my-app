// @/api/building/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { BuildingUpdateSchema } from "@/lib/validations/building";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay, fromUTCToLocal } from "@/utils/datetime";
import { HandleZodError } from "@/utils/validationError";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { normalizeName } from "@/utils/normalizeName";
import { getRoomName } from "@/utils/generateRoomName";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { sortAvailableHours } from "@/utils/sortAvailableHours";

// Get building by id
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
          select: {
            id: true,
            floorNumber: true,
            totalRooms: true,
            label: true,
            rooms: { orderBy: { name: "asc" } },
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
      {
        success: true,
        ...building,
        createdAt: fromUTCToLocal(building.createdAt).toFormat("yyyy-LLL-dd hh:mm:ss a"),
        updatedAt: fromUTCToLocal(building.updatedAt).toFormat("yyyy-LLL-dd hh:mm:ss a"),
        floors: building.floors.map(floor => ({
          ...floor,
          rooms: floor.rooms.map(room => ({
            ...room,
            availableHours: sortAvailableHours(
              room.availableHours as {
                dayOfWeek: string;
                startTime: string;
                endTime: string;
              }[]
            ),
            createdAt: fromUTCToLocal(room.createdAt).toFormat("yyyy-LLL-dd hh:mm:ss a"),
            updatedAt: fromUTCToLocal(room.updatedAt).toFormat("yyyy-LLL-dd hh:mm:ss a"),
          })),
        })),
      },
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
      select: { id: true, name: true },
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
      { 
        success: true,
        message: `Building ${building.name} was successfully deleted`, 
        deletedId: id 
      },
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
    const {
      name,
      address,
      totalFloors,
      hasGroundFloor,
      description,
      totalRoomsOnEachFloor,
      RoomsCapacities,
      RoomsAmenities,
      RoomsAvailableHours,
    } = data;

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
      } else {
        // Update all rooms' name when building name is changed
        for (const floor of existingBuilding.floors) {
          for (const room of floor.rooms) {
            const parts = room.name.split("-");
            parts[0] = titleCasedName
              .split(" ")
              .map((w) => w[0])
              .join("");
            const updateName = parts.join("-");
            await prisma.room.update({
              where: { name: room.name },
              data: { name: updateName },
            });
          }
        }
      }
    }

    // Use effectiveHasGroundFloor: if not provided in the update payload, default to the existing building value
    const effectiveHasGroundFloor =
      typeof hasGroundFloor === "boolean"
        ? hasGroundFloor
        : existingBuilding.hasGroundFloor;

    // Start transaction for floor adjustments, totalRoomsOnEachFloor change, and building update
    const updateBuilding = await prisma.$transaction(async (tx) => {
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
      const floorsAfter = await tx.floor.findMany({
        where: { buildingId: id },
        select: { id: true, floorNumber: true },
      });

      for (const floor of floorsAfter) {
        const rooms = await tx.room.findMany({
          where: { floorId: floor.id },
          include: { bookings: true },
          orderBy: { name: "asc" },
        });
        const existingCount = rooms.length;

        if (totalRoomsOnEachFloor != null) {
          if (existingCount < totalRoomsOnEachFloor) {
            const additional = totalRoomsOnEachFloor - existingCount;
            const newRoomsData = Array.from({ length: additional }).map(
              (_, i) => ({
                floorId: floor.id,
                name: getRoomName(
                  titleCasedName ?? existingBuilding.name,
                  floor.floorNumber,
                  existingCount + i
                ),
                capacity: RoomsCapacities ?? defaultRoomValues.capacities,
                amenities: RoomsAmenities ?? defaultRoomValues.amenities,
                availableHours:
                  RoomsAvailableHours ?? defaultRoomValues.available_hours,
              })
            );
            await tx.room.createMany({ data: newRoomsData });
          }

          if (existingCount > totalRoomsOnEachFloor) {
            const excessRooms = rooms
              .slice(totalRoomsOnEachFloor)
              .filter((r) => r.bookings.length === 0);

            await tx.room.deleteMany({
              where: { id: { in: excessRooms.map((r) => r.id) } },
            });
          }

          await tx.floor.update({
            where: { id: floor.id },
            data: { totalRooms: totalRoomsOnEachFloor },
          });
        }

        if (RoomsCapacities || RoomsAmenities || RoomsAvailableHours) {
          for (const room of rooms) {
            // Create a map from existing for faster lookup
            const hoursMap = new Map<string, any>();
            const overrides = RoomsAvailableHours ?? [];
            const currrentHours = room.availableHours as {
              dayOfWeek: string;
              startTime: string;
              endTime: string;
            }[];
            for (const entry of currrentHours) {
              if (entry?.dayOfWeek) {
                hoursMap.set(entry.dayOfWeek.toLowerCase(), entry);
              }
            }

            // Apply overrides and ensure all days from override are included
            for (const override of overrides) {
              const day = override.dayOfWeek.toLocaleLowerCase();
              const existing = hoursMap.get(day);
              hoursMap.set(
                day,
                existing ? { ...existing, ...override } : { ...override }
              );
            }

            const updatedAvailableHours = Array.from(hoursMap.values());

            await tx.room.update({
              where: { id: room.id },
              data: {
                ...(RoomsCapacities && { capacity: RoomsCapacities }),
                ...(RoomsAmenities && { amenities: RoomsAmenities }),
                ...(RoomsAvailableHours && {
                  availableHours: updatedAvailableHours,
                }),
              },
            });
          }
        }
      }

      const newFloors = await tx.floor.findMany({
        where: { buildingId: id },
        select: { id: true },
      });
      const totalRooms = await tx.room.count({
        where: { floorId: { in: newFloors.map((f) => f.id) } },
      });

      const updatedBuilding = await tx.building.update({
        where: { id },
        data: {
          ...(titleCasedName && { name: titleCasedName }),
          ...(cleanedAddress && { address: cleanedAddress }),
          description,
          totalFloors: effectiveHasGroundFloor
            ? newFloors.length - 1
            : newFloors.length,
          totalRooms,
          hasGroundFloor: effectiveHasGroundFloor,
        },
      });

      return updatedBuilding;
    });

    return NextResponse.json(
      {
        success: true,
        message: `Building ${existingBuilding.name} was successfully updated`,
        updatedBuilding: FormattedDateDisplay(updateBuilding),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error updating building:", error);
    return HandleZodError(error);
  }
}