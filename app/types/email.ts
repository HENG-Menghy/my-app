// @/types/email.ts

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface EmailData {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface OTPEmailData {
  email: string;
  otp: string;
  fullname?: string;
  expiresInMinutes: number;
}

export interface WelcomeEmailData {
  email: string;
  fullname: string;
}

export interface PasswordResetEmailData {
  email: string;
  fullname: string;
  resetCode: string;
  expiresInMinutes: number;
}
