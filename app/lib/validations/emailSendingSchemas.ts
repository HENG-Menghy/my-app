// @/lib/validations/emailSendingSchemas.ts

import { z } from "zod";
import { email, fullname, otp } from "./auth";
import { EmailTypes } from "@/types/email";

export const context = z.object({
  time: z.string().min(1),
  device: z.string().min(1),
  os: z.string().min(1),
  browser: z.string().min(1),
  location: z.object({
    country: z.string().min(1),
    city: z.string().min(1),
  }),
});

export const welcomeEmailSchema = z.object({
  type: z.literal(EmailTypes.welcomeEmail),
  email: email,
  fullname: fullname,
});

export const verificationEmailSchema = z.object({
  type: z.literal(EmailTypes.verificationEmail),
  email: email,
  otp: otp,
  expiry: z.number().positive(),
});

export const loginAlertEmailSchema = z.object({
  type: z.literal(EmailTypes.loginAlertEmail),
  email: email,
  fullname: fullname,
  loginInfo: context,
});

export const passwordResetEmailSchema = z.object({
  type: z.literal(EmailTypes.passwordResetEmail),
  email: email,
  fullname: fullname,
  otp: otp, // reset code
  expiry: z.number().positive(),
});

export const accountRemovalEmailSchema = z.object({
  type: z.literal(EmailTypes.registrationBlockedEmail),
  email: email,
  fullname: fullname,
  expiry: z.number().positive(), // wait time
});

// Union schema
export const EmailRequestSchema = z.discriminatedUnion("type", [
  welcomeEmailSchema,
  verificationEmailSchema,
  loginAlertEmailSchema,
  passwordResetEmailSchema,
  accountRemovalEmailSchema,
]);

export type EmailRequest = z.infer<typeof EmailRequestSchema>;
