// @/utils/sortAvailability.ts

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

export function sortAvailabilityByDay<T extends { dayOfWeek: string }>(
  availability: T[]
): T[] {
  return [...availability].sort((a, b) => {
    const indexA = dayOrder.indexOf(a.dayOfWeek as DayOfWeek);
    const indexB = dayOrder.indexOf(b.dayOfWeek as DayOfWeek);
    return indexA - indexB;
  });
}
