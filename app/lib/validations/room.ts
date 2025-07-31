// @/lib/validations/room.ts

import { z } from "zod";
import { RoomType, RoomStatus } from "@prisma/client";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { AvailableHours } from "./availableHoursSchema";
import { SupabaseImageUrl } from "./urlSchema";

export const RoomSchema = z
  .object({
    floorId: z.string().uuid(),
    name: z.string().min(1).optional(),
    type: z.nativeEnum(RoomType).default(RoomType.meeting),
    status: z.nativeEnum(RoomStatus).default(RoomStatus.active),
    description: z.string().optional(),
    capacity: z.number().int().min(1).default(defaultRoomValues.capacities),
    amenities: z
      .array(z.string().min(1))
      .nonempty()
      .default(defaultRoomValues.amenities),
    availableHours: AvailableHours.default(defaultRoomValues.available_hours),
    imageUrl: SupabaseImageUrl.default(defaultRoomValues.image_url),
  })
  .strict();

export const RoomUpdateSchema = RoomSchema.partial();