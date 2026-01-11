// @/lib/sessionMetadata.ts

import { SessionMetadata } from "@/types/auth";
import { NextRequest } from "next/server";
import { getDeviceInfo } from "./deviceInfo";
import { getGeoLocation } from "./geolocation";

export async function getSessionMetadata(
  request: NextRequest
): Promise<SessionMetadata> {
  const deviceInfo = getDeviceInfo(request);
  const geoLocation = await getGeoLocation(deviceInfo?.ipAddress!);
  return {
    ipAddress: deviceInfo?.ipAddress,
    os: deviceInfo?.os,
    browser: deviceInfo?.browser,
    device: {
      model: deviceInfo?.model,
      type: deviceInfo?.type,
    },
    location: {
      country: geoLocation?.country,
      city: geoLocation?.city,
    },
  };
}
