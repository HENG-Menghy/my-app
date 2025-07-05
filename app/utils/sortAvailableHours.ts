// @/utils/sortAvailableHours.ts

const dayOrder = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DayOfWeek = (typeof dayOrder)[number];

// Sorts by dayOfWeek (based on dayOrder), then by startTime
export function sortAvailableHours(
  availableHours: { dayOfWeek: string; startTime: string; endTime: string }[]
): { dayOfWeek: string; startTime: string; endTime: string }[] {
  const sorted = [...availableHours].sort((a, b) => {
    const dayA = a.dayOfWeek.toLowerCase() as DayOfWeek;
    const dayB = b.dayOfWeek.toLowerCase() as DayOfWeek;

    const dayDiff = dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
    if (dayDiff !== 0) return dayDiff;

    const startA = a.startTime?.trim() || "00:00";
    const startB = b.startTime?.trim() || "00:00";

    return startA.localeCompare(startB);
  });

  return sorted.map(({ dayOfWeek, startTime, endTime }) => ({
    dayOfWeek,
    startTime,
    endTime,
  }));
}