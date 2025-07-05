// @/lib/validations/building.ts

import { z } from "zod";

export const BuildingSchema = z
  .object({
    name: z.string().min(1),
    address: z.string().min(10),
    totalFloors: z.number().min(1),
    totalRoomsOnEachFloor: z.number().min(1),
    hasGroundFloor: z.boolean().optional(),
    description: z.string().optional(),
    RoomsCapacities: z.number().min(1).optional(),
    RoomsAmenities: z.array(z.string()).nonempty().optional(),
    RoomsAvailableHours: z
      .array(
        z.object({
          dayOfWeek: z.enum([
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ]),
          startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        }),
      ).optional(),
  }).strict();

export const BuildingUpdateSchema = BuildingSchema.partial();