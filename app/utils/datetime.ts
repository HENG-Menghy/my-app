// @/utils/datetime.ts

import { DateTime } from "luxon";

const PHNOM_PENH_TZ = "Asia/Phnom_Penh";

/**
  * Converts a datetime-local input string (e.g., "2025-06-07T17:05") to JS date
  * @param input - A string from <input type="datetime-local">
  * @returns Date object
*/
export function LocalToUTC(input: string): Date {
  const local = DateTime.fromISO(input, { zone: PHNOM_PENH_TZ });
  return local.toUTC().toJSDate();
}

/** 
  * Convert UTC time format to local datetime
  * @param input - string, date object, or datetime in utc format
  * @returns Local datetime in Phnom Penh
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
        result[key] = fromUTCToLocal(value).toFormat('yyyy-LLL-dd hh:mm:ss a');
      } else if (typeof value === "string" && DateTime.fromISO(value).isValid) {
        result[key] = fromUTCToLocal(value).toFormat('yyyy-LLL-dd hh:mm:ss a');
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