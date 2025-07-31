// @/api/building/[id]/route.ts

import prisma from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { FormattedDateDisplay, fromUTCToLocal } from "@/utils/datetime";
import { getFloorLabel } from "@/utils/generateFloorLabel";
import { getAcronym, getRoomName } from "@/utils/generateRoomName";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { BuildingUpdateSchema } from "@/lib/validations/building";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { normalizeName } from "@/utils/normalizeName";
import { BookingStatus } from "@prisma/client";

// Get building by id
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        {
          success: false,
          message: "Building not found",
        },
        { status: 404 }
      );
    }

    return ApiResponse.success({
      message: `Successfully get building ${building.name}`,
      data: {
        ...building,
        createdAt: fromUTCToLocal(building.createdAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
        updatedAt: fromUTCToLocal(building.updatedAt).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        ),
        floors: building.floors.map((floor) => ({
          ...floor,
          rooms: floor.rooms.map((room) => ({
            ...room,
            availableHours: sortAvailableHours(
              room.availableHours as {
                dayOfWeek: string;
                startTime: string;
                endTime: string;
              }[]
            ),
            createdAt: fromUTCToLocal(room.createdAt).toFormat(
              "yyyy-LLL-dd hh:mm:ss a"
            ),
            updatedAt: fromUTCToLocal(room.updatedAt).toFormat(
              "yyyy-LLL-dd hh:mm:ss a"
            ),
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching building:", error);
    return ApiResponse.error(error);
  }
}

// Delete building
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Find the building and related floors and rooms
    const building = await prisma.building.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    // Check if the building exists
    if (!building) {
      return NextResponse.json(
        {
          success: false,
          message: "Building not found",
        },
        { status: 404 }
      );
    }

    // Perform deleting building
    await prisma.building.delete({ where: { id } });

    return ApiResponse.success({
      message: `Building ${building.name} was successfully deleted`,
      data: { deletedId: id },
    });
  } catch (error) {
    console.error("Error deleting building: ", error);
    return ApiResponse.error(error);
  }
}

// Update building
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await validateRequest(BuildingUpdateSchema, body);
    const {
      name,
      address,
      location,
      totalFloors,
      hasGroundFloor,
      description,
      totalRoomsOnEachFloor,
      RoomsImage,
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
                bookings: { select: { id: true, status: true } },
              },
            },
          },
          orderBy: { floorNumber: "asc" },
        },
      },
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

    // If name provided, convert name to accronym and upper case
    const newName = name ? normalizeName(name) : undefined;
    const newAddress = address
      ? address.replace(/\s+/g, " ").trim()
      : undefined;

    // Check duplicate building name (if updated)
    if (newName) {
      const existingName = await prisma.building.findFirst({
        where: {
          name: { equals: newName, mode: "insensitive" },
          NOT: { id },
        },
      });

      if (existingName) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot update to name '${newName}': It already exists`,
          },
          { status: 400 }
        );
      }

      // Update all rooms' name when building name is changed
      for (const floor of existingBuilding.floors) {
        for (const room of floor.rooms) {
          if (room.name.includes("-")) {
            const parts = room.name.split("-");
            parts[0] = getAcronym(newName);
            const updateName = parts.join("-");
            await prisma.room.update({
              where: { name: room.name },
              data: { name: updateName.replace(/\-+/, "-") },
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
            const roomsWithBookings = groundFloor.rooms
              .filter((room) => room.bookings.some(
                (booking) => booking.status === BookingStatus.approved
              ))
              .map((room) => room.name);

            if (roomsWithBookings.length > 0) {
              throw {
                status: 400,
                message: "Cannot remove ground floor; some rooms contain approved bookings",
                roomsWithActiveBookings: roomsWithBookings,
              };
            }

            await tx.floor.delete({ where: { id: groundFloor.id } });
          }
        }
      }

      // ─── Floor Adjustments Based on totalFloors ───
      // totalFloors from the payload represents solely the numbered floors (1 .. totalFloors)
      // If effectiveHasGroundFloor is true, allowed floors in the DB = totalFloors + 1 (including floor 0)
      const allowedCount = effectiveHasGroundFloor
        ? (totalFloors ?? existingBuilding.totalFloors) + 1
        : totalFloors ?? existingBuilding.totalFloors;

      // Re-read floors after any ground floor modifications.
      const currentFloors = await tx.floor.findMany({
        where: { buildingId: id },
        select: { floorNumber: true, id: true },
      });
      const currentCount = currentFloors.length;

      if (currentCount < allowedCount!) {
        const missingCount = allowedCount - currentCount;
        const existingFloorNumbers = new Set(
          currentFloors.map((f) => f.floorNumber)
        );

        // Start from 0 if hasGroundFloor is enabled, otherwise from 1
        const start = effectiveHasGroundFloor ? 0 : 1;

        // Generate floor numbers skipping any that already exist
        const newFloorNumbers: number[] = [];
        let next = start;
        while (newFloorNumbers.length < missingCount) {
          if (!existingFloorNumbers.has(next)) {
            newFloorNumbers.push(next);
          }
          next++;
        }

        const newFloors = newFloorNumbers.map((floorNumber) => ({
          buildingId: id,
          floorNumber,
          label: getFloorLabel(floorNumber),
        }));

        await tx.floor.createMany({ data: newFloors });
      } else if (currentCount > allowedCount!) {
        // Remove any excess floors.
        // Only numbered floors beyond the allowed range should be removed.
        // (Ground floor is floor 0 and should never be removed when effectiveHasGroundFloor is true.)
        const excessFloors = existingBuilding.floors
          .filter((floor) => floor.floorNumber > totalFloors!) // floors with floorNumber greater than totalFloors are deemed excess
          .filter((floor) =>
            floor.rooms.every((room) =>
              room.bookings.every(
                (booking) => booking.status !== BookingStatus.approved
              )
            )
          );
        if (excessFloors.length > 0) {
          const excessIds = excessFloors.map((floor) => floor.id);
          await tx.floor.deleteMany({ where: { id: { in: excessIds } } });
        } else {
          const blockedRooms: string[] = existingBuilding.floors
            .filter((floor) => floor.floorNumber > totalFloors!)
            .flatMap((floor) =>
              floor.rooms.filter(
                (room) =>
                  room.bookings.some(
                    (booking) => booking.status === BookingStatus.approved
                  )
              )
            )
            .map((room) => room.name);

          if (blockedRooms.length > 0) {
            throw {
              status: 400,
              message: "Cannot reduce the number of floors because some rooms on the floors have approved bookings",
              roomsWithActiveBookings: blockedRooms,
            };
          }
        }
      }

      // ─── Recalculate Building Totals ───
      const floorsAfter = await tx.floor.findMany({
        where: { buildingId: id },
        select: { id: true, floorNumber: true },
      });

      const roomWithActiveBookings: string[] = [];
      const deletableRoomIds: string[] = [];
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
                  newName ?? existingBuilding.name,
                  floor.floorNumber,
                  existingCount + i
                ),
                imageUrl: RoomsImage ?? defaultRoomValues.image_url,
                capacity: RoomsCapacities ?? defaultRoomValues.capacities,
                amenities: RoomsAmenities ?? defaultRoomValues.amenities,
                availableHours:
                  RoomsAvailableHours ?? defaultRoomValues.available_hours,
              })
            );
            await tx.room.createMany({ data: newRoomsData });
          } else if (existingCount > totalRoomsOnEachFloor) {
            const excessRooms = rooms
              .sort((a, b) => b.bookings.length - a.bookings.length)
              .slice(totalRoomsOnEachFloor);
            for (const room of excessRooms) {
              const hasApprovedBooking = room.bookings.some(
                (booking) => booking.status === BookingStatus.approved
              );
              if (hasApprovedBooking) {
                roomWithActiveBookings.push(room.name);
              } else {
                deletableRoomIds.push(room.id);
              }
            }
          }

          await tx.floor.update({
            where: { id: floor.id },
            data: { totalRooms: totalRoomsOnEachFloor },
          });
        }

        if (
          RoomsImage ||
          RoomsCapacities ||
          RoomsAmenities ||
          RoomsAvailableHours
        ) {
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
                ...(RoomsImage && { imageUrl: RoomsImage }),
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

      if (roomWithActiveBookings.length > 0) {
        throw {
          status: 400,
          message: "Cannot reduce rooms. The following rooms have approved bookings",
          roomsWithActiveBookings: roomWithActiveBookings,
        }
      }

      if (deletableRoomIds.length > 0) {
        await tx.room.deleteMany({
          where: { id: { in: deletableRoomIds } },
        });
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
          ...(newName && { name: newName }),
          ...(newAddress && { address: newAddress }),
          location,
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

    return ApiResponse.success({
      message: `Building ${existingBuilding.name} was successfully updated`,
      data: FormattedDateDisplay(updateBuilding),
    });
  } catch (error: any) {
    console.error("Error updating building:", error);
    if (error.status && error.message) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          roomsWithActiveBookings: error.roomsWithActiveBookings,
        },
        { status: error.status }
      );
    }
    return ApiResponse.error(error);
  }
}