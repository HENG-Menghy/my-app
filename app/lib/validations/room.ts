// @/lib/validations/room.ts

import { z } from "zod";
import { RoomType, RoomStatus } from "@prisma/client";
import { defaultAttributes } from "@/utils/defaultRoomAttributes";
import { AvailableHoursSchema } from "./availableHoursSchema";
import { SupabaseImageURLSchema } from "./urlSchema";

export const RoomSchema = z
  .object({
    floorId: z.string().uuid(),
    name: z.string().min(1).optional(),
    type: z.nativeEnum(RoomType).default(RoomType.meeting),
    status: z.nativeEnum(RoomStatus).default(RoomStatus.active),
    description: z.string().optional(),
    capacity: z.number().int().min(1).default(defaultAttributes.capacities),
    amenities: z
      .array(z.string().min(1))
      .nonempty()
      .default(defaultAttributes.amenities),
    availableHours: AvailableHoursSchema.default(defaultAttributes.available_hours),
    imageUrl: SupabaseImageURLSchema.default(defaultAttributes.image_url),
  })
  .strict();

export const RoomUpdateSchema = RoomSchema.partial().refine((data) => {
  Object.keys(data).length > 0,
    { message: "At least one field must be provided" };
});
