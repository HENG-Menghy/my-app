// @/lib/api/geolocation.ts

import { Logger } from "../logger";

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
    // Add timeout to prevent hanging if ipapi.co is slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 seconds

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Failed to get geolocation by ip: ${ip}`);
    const data = await res.json();

    return {
      country: data.country_name ?? "Unknown",
      city: data.city ?? "Unknown",
      region: data.region ?? "Unknown",
    };
  } catch (error) {
    Logger.error("IPAPI_ERROR", error as Error);
    return {
      country: "Unknown",
      city: "Unknown",
      region: "Unknown",
    };
  }
}
