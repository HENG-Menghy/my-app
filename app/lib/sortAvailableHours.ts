type TimeSlot = {
  start: string;
  end: string;
};

type AvailableHours = Record<string, TimeSlot[]>;

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function sortAvailableHours(hours: AvailableHours = {}): AvailableHours {
  const ordered: AvailableHours = {};

  for (const day of dayOrder) {
    ordered[day] = hours[day] ?? [];
  }

  return ordered;
}
