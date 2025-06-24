// @/lib/validations/room.ts

import { z } from "zod";
import { RoomType, RoomStatus } from "@prisma/client";

export const RoomSchema = z.object({
  floorId: z.string().uuid(),
  imageUrl: z.string().url().optional(),
  name: z.string().min(1).optional(),
  type: z.nativeEnum(RoomType).default(RoomType.meeting),
  capacity: z.number().min(1).optional(),
  amenities: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.active),
  availability: z.array(
    z.object({
      dayOfWeek: z.enum([
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
      ]),
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default(""),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default(""),
      isAvailable: z.boolean().optional(),
    })
  ).optional(),
}).strict();

export const RoomUpdateSchema = RoomSchema.partial();