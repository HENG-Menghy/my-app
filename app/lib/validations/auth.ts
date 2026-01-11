// @/lib/validations/auth.ts

import { UserGender } from "@prisma/client";
import { z } from "zod";
import { SupabaseImageURLSchema } from "./urlSchema";

export const email = z.string().email("Invalid email address");
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(16, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  );

export const phone = z
  .string()
  .regex(
    /^(0(10|11|12|14|15|16|17|31|60|61|66|67|68|69|70|071|076|078|079|086|087|088|090|092|095|096|097|098|099))\d{6,7}$/,
    "Invalid phone number format in Cambodia"
  );

export const fullname = z
  .string()
  .min(5, "Full name must be at least 5 characters")
  .max(20, "Full name must not exceed 20 characters");

export const otp = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^[0-9]+$/, "OTP must contain only numbers");

export const RegisterSchema = {
  initial: z.object({ email: email }).strict(),

  verify: z
    .object({
      email: email,
      otp: otp,
    })
    .strict(),

  complete: z
    .object({
      email: email,
      password: password,
      fullname: z
        .string()
        .min(5, "Full name must be at least 5 characters")
        .max(20, "Full name must not exceed 20 characters"),
      phonenumber: phone,
      gender: z.nativeEnum(UserGender),
      imageUrl: SupabaseImageURLSchema.optional(),
    })
    .strict(),
};

export const LoginSchema = z
  .object({
    email: email,
    password: z.string().min(1, "Password must be provided"),
  })
  .strict();

export const PasswordSchema = {
  reset: z
    .object({
      email: email,
    })
    .strict(),

  verify: z
    .object({
      email: email,
      otp: otp,
    })
    .strict(),

  complete: z
    .object({
      email: email,
      otp: otp,
      password: password,
      confirmPassword: password,
    })
    .strict()
    .refine((data) => data.password === data.confirmPassword, {
      message: "Password does not match",
      path: ["confirmPassword"],
    }),

  change: z
    .object({
      currentPassword: z.string().min(1, "Current password must be provided"),
      newPassword: password,
      confirmPassword: password,
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.currentPassword === data.newPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["newPassword"],
          message: "New password must be different from current password",
        });
      }

      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "Password does not match",
        });
      }
    }),
};

export const ProfileUpdateSchema = z
  .object({
    fullname: fullname.optional(),
    phonenumber: phone.optional(),
    gender: z.nativeEnum(UserGender).optional(),
    imageUrl: SupabaseImageURLSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
