// @/lib/validations/building.ts

import { z } from "zod";
import { defaultRoomValues } from "@/utils/defaultRoomValues";
import { AvailableHours } from "./availableHoursSchema";
import { GoogleMapsUrl, SupabaseImageUrl } from "./urlSchema";

export const BuildingSchema = z
  .object({
    name: z.string().min(1),
    address: z.string().min(10),
    location: GoogleMapsUrl.optional(),
    totalFloors: z.number().int().min(0).default(0),
    totalRoomsOnEachFloor: z.number().int().min(0).default(0),
    hasGroundFloor: z.boolean().optional(),
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

export const BuildingUpdateSchema = BuildingSchema.partial();