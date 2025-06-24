// @/types/auth.ts

import type { User, UserRole, UserGender } from "@prisma/client";

// Auth Response Types
export interface AuthResponse {
  user: {
    id: string;
    fullname: string;
    email: string;
    role: UserRole;
  };
  session?: {
    id: string;
    expiresAt: string;
  };
  tokens: AuthTokens;
}

// Token and Session Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  uid: string;
  sid: string;
  email: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  uid: string;
  sid: string;
}

// Metadata of session
export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    type?: string;
    vendor?: string;
    model?: string;
    os?: string;
    browser?: string;
  };
  location?: {
    country: string;
    city: string;
  };
  actor?: string;
  action?: string;
}

// Login Types
export interface LoginCredentials {
  email: string;
  password: string;
}

// Registration Types
export interface RegisterInitialData {
  email: string;
}

export interface RegisterVerifyData {
  email: string;
  otp: string;
}

export interface RegisterCompleteData {
  email: string;
  password: string;
  fullname: string;
  phonenumber: string;
  gender: UserGender;
  imageUrl?: string;
}

// Password Reset Types
export interface PasswordResetInitData {
  email: string;
}

export interface PasswordResetVerifyData {
  email: string;
  otp: string;
}

export interface PasswordResetCompleteData {
  email: string;
  otp: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// User Related Types
export interface UserProfile
  extends Pick<
    User,
    | "id"
    | "email"
    | "fullname"
    | "phonenumber"
    | "gender"
    | "imageUrl"
    | "role"
    | "status"
  > {
  emailVerified: boolean;
  lastLoginAt: Date | null;
}