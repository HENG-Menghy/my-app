// @/lib/validations/availableHoursSchema.ts

import { z } from "zod";

export const AvailableHoursSchema = z.array(
  z
    .object({
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
    })
    .refine((obj) => obj.startTime < obj.endTime, {
      message: "endTime must be later than startTime",
    })
);

export type AvailableHour = z.infer<typeof AvailableHoursSchema>[number];
export type AvailableHours = z.infer<typeof AvailableHoursSchema>;
