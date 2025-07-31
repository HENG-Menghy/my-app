// @/api/room/default/route.ts

import { z } from "zod";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";

const validInput = z
  .object({
    RoomsImage: RoomUpdateSchema.shape.imageUrl,
    RoomsCapacities: RoomUpdateSchema.shape.capacity,
    RoomsAmenities: RoomUpdateSchema.shape.amenities,
    RoomsAvailableHours: RoomUpdateSchema.shape.availableHours,
  })
  .strict();

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { RoomsImage, RoomsCapacities, RoomsAmenities, RoomsAvailableHours } =
      await validateRequest(validInput, body);
    const rooms = await prisma.room.findMany();
    for (const room of rooms) {
      const hoursMap = new Map<string, any>();
      const overrides = RoomsAvailableHours ?? [];
      const current = room.availableHours as {
        dayOfWeek: string;
        startTime: string;
        endTime: string;
      }[];
      for (const entry of current) {
        if (entry?.dayOfWeek) {
          hoursMap.set(entry.dayOfWeek.toLocaleLowerCase(), entry);
        }
      }
      for (const override of overrides) {
        const day = override.dayOfWeek.toLocaleLowerCase();
        const existing = hoursMap.get(day);
        hoursMap.set(
          day,
          existing ? { ...existing, ...override } : { ...override }
        );
      }
      await prisma.room.update({
        where: { id: room.id },
        data: {
          ...(RoomsImage && { imageUrl: RoomsImage }),
          ...(RoomsCapacities && { capacity: RoomsCapacities }),
          ...(RoomsAmenities && { amenities: RoomsAmenities }),
          ...(RoomsAvailableHours && {
            availableHours: Array.from(hoursMap.values()),
          }),
        },
      });
    }
    const updatedRooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        capacity: true,
        amenities: true,
        availableHours: true,
      },
      orderBy: { name: "asc" },
    });
    return ApiResponse.success(
      {
        message: "Default rooms value successfully updated to all rooms",
        data: updatedRooms.map((room) => ({
          ...room,
          availableHours: sortAvailableHours(
            room.availableHours as {
              dayOfWeek: string;
              startTime: string;
              endTime: string;
            }[]
          ),
        })),
      },
    );
  } catch (error) {
    return ApiResponse.error(error);
  }
}