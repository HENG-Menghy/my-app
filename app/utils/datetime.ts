// @/utils/datetime.ts

import { DateTime } from "luxon";

const PHNOM_PENH_TZ = "Asia/Phnom_Penh";

// Get current datetime in Phnom Penh
export const nowPhomPenh = (): DateTime => {
  return DateTime.now().setZone(PHNOM_PENH_TZ);
}

// Get current UTC datetime
export const nowUTC = (): DateTime => {
  return DateTime.utc();
}

/**
  * Converts a datetime-local input string (e.g., "2025-06-07T17:05") to UTC datetime
  * @param input - A string from <input type="datetime-local">
  * @returns Date object
*/
export function LocalToUTC(input: string): Date {
  const local = DateTime.fromISO(input, { zone: PHNOM_PENH_TZ });
  return local.toUTC().toJSDate();
}

/** 
  * Convert UTC time format to Phnom Penh datetime
  * @param input - string, date object, or datetime in utc format
  * @returns Local luxon datetime format
*/
export function fromUTCToLocal (date: Date | DateTime | string): DateTime {
  let dt: DateTime;

  if (date instanceof DateTime) {
    dt = date;
  } else if (typeof date === 'string') {
    dt = DateTime.fromISO(date, { zone: 'utc' });
  } else {
    dt = DateTime.fromJSDate(date);
  }

  return dt.setZone(PHNOM_PENH_TZ);
}

export function FormattedDateDisplay<T = unknown>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(FormattedDateDisplay) as unknown as T;
  }

  if (data && typeof data === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        result[key] = fromUTCToLocal(value).toFormat('yyyy LLL dd hh:mm:ss a');
      } else if (typeof value === "string" && DateTime.fromISO(value).isValid) {
        result[key] = fromUTCToLocal(value).toFormat('yyyy LLL dd hh:mm:ss a');
      } 
      else if (typeof value === "object") {
        result[key] = FormattedDateDisplay(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}