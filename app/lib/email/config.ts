// @/lib/email/config.ts

import nodemailer from "nodemailer";
import { Logger } from "../logger";

// Validate required env variables for mail sender (SMTP)
if (["production", "development"].includes(process.env.NODE_ENV || "")) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    Logger.error(
      `Missing SMTP env variables: ${missing.join(", ")}`,
      new Error("SMTP environment misconfiguration")
    );
    throw new Error("Missing required SMTP configuration");
  }
}

export const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Do not fail on invalid certificates in development
    rejectUnauthorized: process.env.NODE_ENV === "production",
    minVersion: "TLSv1.2",
  },
  pool: true, // Enable pooling for better performance
  maxConnections: 5,
  maxMessages: 100,
  // Retry configuration
  socketTimeout: 30000, // 30 seconds
  connectionTimeout: 30000, // 30 seconds
});