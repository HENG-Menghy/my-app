// @/lib/convertTimestamps.ts

import { toZonedTime, format } from 'date-fns-tz'

const timeZone = 'Asia/Phnom_Penh'

function toPhnomPenhTime(date: Date): string {
  const zoned = toZonedTime(date, timeZone);
  return format(zoned, 'yyyy-MM-dd HH:mm:ss a', { timeZone });
}

export function convertDatesToPhnomPenhTimezone<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(convertDatesToPhnomPenhTimezone) as unknown as T
  }

  if (data && typeof data === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        result[key] = toPhnomPenhTime(value)
      } else if (typeof value === 'object') {
        result[key] = convertDatesToPhnomPenhTimezone(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  return data
}
