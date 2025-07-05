// @/api/room/default/route.ts

import { z } from "zod";
import { RoomUpdateSchema } from "@/lib/validations/room";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { sortAvailableHours } from "@/utils/sortAvailableHours";
import { HandleZodError } from "@/utils/validationError";

const validInput = z.object({
  RoomsCapacities: RoomUpdateSchema.shape.capacity,
  RoomsAmenities: RoomUpdateSchema.shape.amenities,
  RoomsAvailableHours: RoomUpdateSchema.shape.availableHours,
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {RoomsCapacities, RoomsAmenities, RoomsAvailableHours} = validInput.parse(body);
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
        if(entry?.dayOfWeek) {
          hoursMap.set(entry.dayOfWeek.toLocaleLowerCase(), entry);
        }
      }
      for (const override of overrides) {
        const day = override.dayOfWeek.toLocaleLowerCase();
        const existing = hoursMap.get(day);
        hoursMap.set(day, existing ? { ...existing, ...override } : { ...override });
      }
      await prisma.room.update({ 
        where: { id: room.id },
        data: {
          ...(RoomsCapacities && { capacity: RoomsCapacities }),
          ...(RoomsAmenities && { amenities: RoomsAmenities }),
          ...(RoomsAvailableHours && { availableHours: Array.from(hoursMap.values()) }),
        }, 
      });
    }
    const updatedRooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        capacity: true,
        amenities: true,
        availableHours: true,
      },
    });
    return NextResponse.json(
      { 
        success: true,
        message: "Default rooms value successfully updated to all rooms",
        AllRooms: updatedRooms.map(room => ({
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
      { status: 200 }
    );
  } catch (error) {
    return HandleZodError(error);
  }
}