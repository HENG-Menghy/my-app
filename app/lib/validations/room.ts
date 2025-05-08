// @/lib/validations/room.ts

import { z } from 'zod';
import { RoomType, RoomStatus } from '@prisma/client';

export const RoomSchema = z.object({
    floorId: z.string().uuid(),
    imageUrl: z.string().url().optional(),
    name: z.string().min(1),
    type: z.nativeEnum(RoomType).default(RoomType.meeting),
    capacity: z.number().min(1),
    amenities: z.array(z.string()),
    description: z.string().optional(),
    status: z.nativeEnum(RoomStatus).default(RoomStatus.active),
    availableHours: z.record(
        z.enum([
          "monday", "tuesday", "wednesday", "thursday",
          "friday", "saturday", "sunday",
        ]),
        z.array(
          z.object({
            start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
            end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          })
        )
      )
}).strict();

export const RoomUpdateSchema = RoomSchema.partial();