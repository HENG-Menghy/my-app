// @/lib/validations/floor.ts

import { z } from "zod";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { SupabaseImageUrl } from "./urlSchema";
import { AvailableHours } from "./availableHoursSchema";

export const FloorSchema = z
  .object({
    buildingId: z.string().uuid(),
    floorNumber: z.number().int().min(0).default(0),
    totalRooms: z.number().int().min(0).default(0),
    name: z.string().optional(),
    description: z.string().optional(),
    RoomsImage: SupabaseImageUrl.default(defaultRoomValues.image_url),
    RoomsCapacities: z
      .number()
      .int()
      .min(1)
      .default(defaultRoomValues.capacities),
    RoomsAmenities: z
      .array(z.string().min(1))
      .nonempty()
      .default(defaultRoomValues.amenities),
    RoomsAvailableHours: AvailableHours.default(
      defaultRoomValues.available_hours
    ),
  })
  .strict();

export const FloorUpdateSchema = FloorSchema.partial();