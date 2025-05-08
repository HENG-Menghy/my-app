// @/lib/validations/floor.ts

import { z } from 'zod';

export const FloorSchema = z.object({
    buildingId: z.string().uuid(),
    floorNumber: z.number().min(0),
    totalRooms: z.number().min(1),
    name: z.string().optional(),
    description: z.string().optional()
}).strict();

export const FloorUpdateSchema = FloorSchema.partial();