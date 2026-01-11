// @/lib/validations/urlSchema.ts

import { z } from "zod";

export const SupabaseImageURLSchema = z.string().superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    const isValid =
      url.protocol === "https:" &&
      url.hostname === "lpymuofbexgjrijarltz.supabase.co" &&
      url.pathname.startsWith("/storage/v1/object/public/");

    if (!isValid) {
      return ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invalid URL. The link must point to a file in a public Supabase bucket.",
      });
    }
  } catch {
    return ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid URL format.",
    });
  }
});

export const GoogleMapURLSchema = z.string().superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    const isValid =
      url.protocol === "https:" &&
      url.hostname === "www.google.com" &&
      url.pathname.startsWith("/maps/place/");

    if (!isValid) {
      return ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "The URL must be a direct link to a specific place on Google Maps.",
      });
    }
  } catch {
    return ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid URL format.",
    });
  }
});