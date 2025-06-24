// @/lib/api/client.ts

import { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";
import { Logger } from "../logger";

export function getClientInfo(request: NextRequest) {
  try {
    const userAgentString = request.headers.get("user-agent");
    const forwarded = request.headers.get("x-forwarded-for");
    let ip = forwarded?.split(",")[0]?.trim();

    // parse the user-agent
    const parser = new UAParser(userAgentString!);
    const result = parser.getResult();

    if (ip === "::1" || ip === "127.0.0.1") {
      return {
        ipAddress: "localhost",
        userAgent: userAgentString ?? "Unknown",
        deviceInfo: {
          type: `localhost ${result.device.type ?? "device_type"}`,
          vendor: `localhost ${result.device.vendor ?? "device_vendor"}`,
          model: `localhost ${result.device.model ?? "device_model"}`,
          os: `localhost ${result.os.name ?? "os"} ${result.os.version ?? "version"}`,
          browser: `localhost ${result.browser.name ?? "browser"} ${result.browser.version ?? "version"}`,
        },
      };
    };

    return {
      ipAddress: ip,
      userAgent: userAgentString ?? "Unknown",
      deviceInfo: {
        type: result.device.type ?? "Unknown",
        vendor: result.device.vendor ?? "Unknown",
        model: result.device.model ?? "Unknown",
        os:
          result.os.name && result.os.version
            ? `${result.os.name} ${result.os.version}`
            : "Unknown",
        browser:
          result.browser.name && result.browser.version
            ? `${result.browser.name} ${result.browser.version}`
            : "Unknown",
      },
    };
  } catch (error) {
    Logger.error("GET_CLIENT_INFO_ERROR", error as Error);
    return {
      ipAddress: "Unknown",
      userAgent: "Unknown",
      deviceInfo: {
        type: "Unknown",
        vendor: "Unknown",
        model: "Unknown",
        os: "Unknown",
        browser: "Unknown",
      },
    };
  }
}
