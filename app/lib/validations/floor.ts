// @/lib/validations/floor.ts

import { z } from "zod";
import { defaultAttributes } from "@/utils/defaultRoomAttributes";
import { SupabaseImageURLSchema } from "./urlSchema";
import { AvailableHoursSchema } from "./availableHoursSchema";

export const FloorSchema = z
  .object({
    buildingId: z.string().uuid(),
    floorNumber: z.number().int().min(0).default(0),
    totalRooms: z.number().int().min(0).default(0),
    name: z.string().optional(),
    description: z.string().optional(),
    RoomsImage: SupabaseImageURLSchema.default(defaultAttributes.image_url),
    RoomsCapacities: z
      .number()
      .int()
      .min(1)
      .default(defaultAttributes.capacities),
    RoomsAmenities: z
      .array(z.string().min(1))
      .nonempty()
      .default(defaultAttributes.amenities),
    RoomsAvailableHours: AvailableHoursSchema.default(
      defaultAttributes.available_hours
    ),
  })
  .strict();

export const FloorUpdateSchema = FloorSchema.partial().refine((data) => {
  Object.keys(data).length > 0,
    { message: "At least one field must be provided" };
});
