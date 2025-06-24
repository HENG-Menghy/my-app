// @/lib/validations/auth.ts

import { UserGender } from '@prisma/client';
import { z } from 'zod';

const email = z.string().email('Invalid email address');
const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(16, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const phone =  z.string()
  .regex(
    /^(0(10|11|12|14|15|16|17|31|60|61|66|67|68|69|70|071|076|078|079|086|087|088|090|092|095|096|097|098|099))\d{6,7}$/,
    'Invalid Cambodian phone number'
  );

const otp = z.string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^[0-9]+$/, 'OTP must contain only numbers');

export const registerSchema = {
  initial: z.object({ email: email }).strict(),

  verify: z.object({
    email: email,
    otp: otp
  }).strict(),

  complete: z.object({
    email: email,
    password: password,
    fullname: z.string()
      .min(5, 'Full name must be at least 5 characters')
      .max(20, 'Full name must not exceed 20 characters'),
    phonenumber: phone,
    gender: z.nativeEnum(UserGender),
    imageUrl: z.string().url().optional()
  }).strict()
};

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, 'Password is required')
}).strict();

export const passwordSchema = {
  reset: z.object({
    email: email
  }).strict(),

  verify: z.object({
    email: email,
    otp: otp
  }).strict(),

  complete: z.object({
    email: email,
    otp: otp,
    password: password
  }).strict(),

  change: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password
  }).strict().refine(data => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword']
  })
};

export const profileSchema = z.object({
  email: email.optional(),
  fullname: z.string()
    .min(5, 'Full name must be at least 5 characters')
    .max(20, 'Full name must not exceed 20 characters')
    .optional(),
  phonenumber: phone.optional(),
  gender: z.nativeEnum(UserGender).optional(),
  imageUrl: z.string().url().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});