// @/lib/api/validate.ts

import { z } from 'zod'

export async function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> {
  try {
    return await schema.parseAsync(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error
    }

    throw new Error('Validation failed: ', error as Error)
  }
}