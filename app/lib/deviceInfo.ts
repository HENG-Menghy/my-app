// @/lib/getDeviceInfo.ts

import { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";
import { Logger } from "./logger";

export function getDeviceInfo(request: NextRequest): {
  ipAddress: string;
  os: string;
  model: string;
  type: string;
  browser: string;
} {
  try {
    const userAgentString = request.headers.get("user-agent");
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();

    // parse the user-agent
    const parser = new UAParser(userAgentString!);
    const result = parser.getResult();
    const { device, os, browser, cpu } = result;

    if (ip === "::1" || ip === "127.0.0.1") {
      return {
        ipAddress: "localhost",
        os: `localhost ${os?.name ?? "os"} ${os?.version ?? "version"}`,
        model: `localhost ${
          device?.model ??
          `${
            os?.name && cpu?.architecture
              ? `${os.name} PC ${cpu.architecture}`
              : "device"
          }`
        }`,
        type: `localhost ${device.type ?? "PC"}`,
        browser: `localhost ${browser?.name ?? "browser"} ${
          browser?.version ?? "version"
        }`,
      };
    }

    return {
      ipAddress: ip!,
      os: os?.name && os?.version ? `${os.name} ${os.version}` : "Unknown",
      model:
        device?.model ??
        (os?.name && cpu?.architecture
          ? `${os.name} PC ${cpu.architecture}`
          : "Unknown"),
      type: device.type ?? "PC",
      browser:
        browser?.name && browser?.version
          ? `${browser.name} ${browser.version}`
          : "Unknown",
    };
  } catch (error) {
    Logger.error("GET_DEVICE_INFO_ERROR", error as Error);
    return {
      ipAddress: "Unknown",
      os: "Unknown",
      model: "Unknown",
      type: "Unknown",
      browser: "Unknown",
    };
  }
}
