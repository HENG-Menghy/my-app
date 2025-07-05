// @/utils/defaultRoomValues.ts

export const defaultRoomValues = {
  capacities: 12,
  amenities: ["projector", "whiteboard", "air-conditioned"],
  available_hours: [
    { dayOfWeek: "monday", startTime: "08:00", endTime: "17:00" }, 
    { dayOfWeek: "tuesday", startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: "wednesday", startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: "thursday", startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: "friday", startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: "saturday", startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: "sunday", startTime: "00:00", endTime: "00:00" }
  ],
}