// @/lib/geolocation.ts

import { Logger } from "./logger";

// Get geolocation by ip
export async function getGeoLocation(ip: string): Promise<{
  country: string;
  city: string;
  region?: string;
}> {
  if (["localhost", "127.0.0.1", "::1"].includes(ip)) {
    return {
      country: "localhost country",
      city: "localhost city",
      region: "localhost region",
    };
  }

  try {
    // Manges fetching with AbortController
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 seconds to cancel or stop operation
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Failed to get geolocation by ip: ${ip}`);
    const data = await res.json();

    return {
      country: data.country_name ?? "Unknown",
      city: data.city ?? "Unknown",
      region: data.region ?? "Unknown",
    };
  } catch (error) {
    Logger.error("GET_GEOLOCATION_ERROR", error as Error);
    return {
      country: "Unknown",
      city: "Unknown",
      region: "Unknown",
    };
  }
}
