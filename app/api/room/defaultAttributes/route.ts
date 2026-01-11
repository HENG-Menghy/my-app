// @/api/room/defaultAttributes/route.ts

import { z } from "zod";
import { RoomSchema } from "@/lib/validations/room";
import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { getAuthUser } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/errors";
import { UserRole } from "@prisma/client";

const validInput = z
  .object({
    RoomsImage: RoomSchema.shape.imageUrl.optional(),
    RoomsCapacities: RoomSchema.shape.capacity.optional(),
    RoomsAmenities: RoomSchema.shape.amenities.optional(),
    RoomsAvailableHours: RoomSchema.shape.availableHours.optional(),
  })
  .strict()
  .refine((data) => {
    Object.keys(data).length > 0,
      { message: "At least one field must be provided" };
  });

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.admin)
      throw AuthError.forbidden();
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
    return ApiResponse.success({
      message: "Default rooms properties was updated successfully to all rooms",
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
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
