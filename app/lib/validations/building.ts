// @/lib/validations/building.ts

import { z } from 'zod';

export const BuildingSchema = z.object({
  name: z.string().min(1),
  totalFloors: z.number().min(1),
  address: z.string().min(10),
  description: z.string().optional(),
  hasGroundFloor: z.boolean().optional()
}).strict();

export const BuildingUpdateSchema = BuildingSchema.partial();