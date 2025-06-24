// @/lib/api/session.ts

import { SessionMetadata } from "@/types/auth";
import { NextRequest } from "next/server";
import { getClientInfo } from "./client";
import { getGeoLocation } from "./geolocation";

export async function getSessionMetadata(request: NextRequest): Promise<SessionMetadata> {
    const clientInfo = getClientInfo(request);
    const geoLocation = await getGeoLocation(clientInfo?.ipAddress!);
    return {
        ipAddress: clientInfo?.ipAddress,
        userAgent: clientInfo?.userAgent,
        deviceInfo: {
            type: clientInfo?.deviceInfo?.type,
            vendor: clientInfo?.deviceInfo?.vendor,
            model: clientInfo?.deviceInfo?.model,
            os: clientInfo?.deviceInfo?.os,
            browser: clientInfo?.deviceInfo?.browser,
        },
        location: {
            country: geoLocation?.country,
            city: geoLocation?.city
        }
    }
}