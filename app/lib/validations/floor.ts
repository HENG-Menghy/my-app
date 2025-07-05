// @/lib/validations/floor.ts

import { z } from "zod";

export const FloorSchema = z
  .object({
    buildingId: z.string().uuid(),
    floorNumber: z.number().min(0),
    totalRooms: z.number().min(1),
    name: z.string().optional(),
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

export const FloorUpdateSchema = FloorSchema.partial();