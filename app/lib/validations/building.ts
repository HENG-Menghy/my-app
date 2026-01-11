// @/lib/validations/building.ts

import { z } from "zod";
import { defaultAttributes } from "@/utils/defaultRoomAttributes";
import { AvailableHoursSchema } from "./availableHoursSchema";
import { GoogleMapURLSchema, SupabaseImageURLSchema } from "./urlSchema";

export const BuildingSchema = z
  .object({
    name: z.string().min(1),
    address: z.string().min(10),
    location: GoogleMapURLSchema.optional(),
    totalFloors: z.number().int().min(0).default(0),
    totalRoomsOnEachFloor: z.number().int().min(0).default(0),
    hasGroundFloor: z.boolean().optional(),
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

export const BuildingUpdateSchema = BuildingSchema.partial().refine((data) => {
  Object.keys(data).length > 0,
    { message: "At least one field must be provided" };
});
