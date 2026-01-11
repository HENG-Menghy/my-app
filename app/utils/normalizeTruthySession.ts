// @/utils/normalizeTruthSession.ts

import { SessionMetadata } from "@/types/auth";

export function normalizeTruthySession(
  metadata: SessionMetadata,
  email: string
): string {
  const { ipAddress, device, location } = metadata;
  const ip = ipAddress.split(".").slice(0,3).join(".").trim();
  const os = metadata.os.toLowerCase().replace(" ", "").trim();
  const city = location.city.toLowerCase().replaceAll(" ", "_").trim();
  const country = location.country.toLowerCase().replaceAll(" ", "_").trim();

  // For mobile, use os + location + email match
  if (device.type.toLowerCase() === "mobile") {
    return `${os}:${country}:${city}:${email}`;
  }

  // Fallback to use 3-octets IP + email match
  return `${ip}:${email}`;
}