// @/types/auth.ts

import type {
  User,
  UserRole,
  UserGender,
  AuthEventType,
  AuthEventStatus,
} from "@prisma/client";

// Auth User Payload Type
export interface AuthUserPayload {
  userId: string;
  sessionId: string;
  email: string;
  role: UserRole;
}

// Token Types
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

// Session and Audit Types
export interface SessionMetadata {
  ipAddress: string;
  os: string;
  browser: string;
  device: {
    model: string;
    type: string;
  };
  location: {
    country: string;
    city: string;
  };
}

export interface SessionWithAuthEvent {
  userId: string | null;
  type: AuthEventType;
  status: AuthEventStatus;
  actor: string;
  reason: string | null;
  revoked: boolean;
  revokedAt: Date | null;
  expiresAt: Date | null;
  metadata: SessionMetadata;
}

// Login Type
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

// Password Types
export interface PasswordResetInitialData {
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
  confirmPassword: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Profile Types
export interface ProfileUpdateData {
  fullname?: string;
  phonenumber?: string;
  gender?: UserGender;
  imageUrl?: string;
}

export interface ProfileData extends Pick<
  User, 
  "id" | 
  "email" |
  "phonenumber" |
  "fullname" |
  "imageUrl" |
  "gender" |
  "role" |
  "status" |
  "emailVerified" |
  "lastLoginAt" |
  "passwordChangedAt"
> {}
