// @/lib/logger.ts

import { fromUTCToLocal } from "@/utils/datetime";

type LogLevel = "info" | "error" | "warn" | "debug";

interface LogMetadata {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  user?: string;
  requestId?: string;
  hash?: string;
}

const ENV = process.env.NODE_ENV || "development";
const IS_PROD = process.env.NODE_ENV === "production";

export class Logger {
  // Sensitive fields that should be masked in logs
  private static readonly SENSITIVE_FIELDS = [
    "uid",
    "sid",
    "accessToken",
    "refreshToken",
    "otp",
    "password",
    // "actor",
    // "text",
  ];

  private static formatMessage(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    user?: string
  ): LogEntry {
    const timestamp = fromUTCToLocal(new Date()).toFormat("yyyy-LLL-dd hh:mm:ss a");
    const maskedMetadata = metadata
      ? this.maskSensitiveData(metadata)
      : undefined;

    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      metadata: maskedMetadata,
      user: user,
    };

    return logEntry;
  }

  private static maskSensitiveData(data: any): any {
    if (!data) return data;
    if (typeof data !== "object") return data;

    const masked = { ...data };

    for (const [key, value] of Object.entries(masked)) {
      // Check if the key is sensitive
      if (
        this.SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field))
      ) {
        masked[key] = "********";
        continue;
      }

      // Recursively mask nested objects
      if (value && typeof value === "object") {
        masked[key] = this.maskSensitiveData(value);
      }
    }

    return masked;
  }

  private static writeLog(logEntry: LogEntry) {
    if (IS_PROD) {
      // TODO: Implement production logging service
      console.log(JSON.stringify(logEntry));
      return;
    }

    // Development logging with colors
    const colors = {
      info: "\x1b[36m", // Cyan
      error: "\x1b[31m", // Red
      warn: "\x1b[33m", // Yellow
      debug: "\x1b[32m", // Green
      reset: "\x1b[0m",
    };

    
    const color = colors[logEntry.level];
    console.log(
      `${color}[${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${
        logEntry.message
      }${colors.reset}` +
        (logEntry.metadata
          ? `\nMetadata: ${JSON.stringify(logEntry.metadata, null, 2)}`
          : "")
    );
  }

  static info(message: string, metadata?: LogMetadata) {
    this.writeLog(this.formatMessage("info", message, metadata));
  }

  static error(message: string, error: Error, metadata?: LogMetadata) {
    const errorMetadata = {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
      },
    };
    this.writeLog(this.formatMessage("error", message, errorMetadata));
  }

  static warn(message: string, metadata?: LogMetadata) {
    this.writeLog(this.formatMessage("warn", message, metadata));
  }

  static debug(message: string, metadata?: LogMetadata) {
    if (ENV !== "production") {
      this.writeLog(this.formatMessage("debug", message, metadata));
    }
  }

  static request(
    method: string,
    path: string,
    metadata?: LogMetadata & { requestId?: string }
  ) {
    const requestMetadata = {
      method,
      path,
      ...metadata,
      timestamp: fromUTCToLocal(new Date()),
    };
    this.writeLog(
      this.formatMessage("info", `HTTP ${method} ${path}`, requestMetadata)
    );
  }
}