// @/types/email.ts

export const EmailTypes = {
  welcomeEmail: "welcomeEmail",
  verificationEmail: "verificationEmail",
  loginAlertEmail: "loginAlertEmail",
  passwordResetEmail: "passwordResetEmail",
  registrationBlockedEmail: "registrationBlockedEmail",
};

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

export interface VerificationEmailData {
  type: typeof EmailTypes.verificationEmail;
  email: string;
  otp: string;
  expiry: number;
}

export interface WelcomeEmailData {
  type: typeof EmailTypes.welcomeEmail;
  email: string;
  fullname: string;
}

export interface PasswordResetEmailData {
  type: typeof EmailTypes.passwordResetEmail;
  email: string;
  fullname: string;
  otp: string;
  expiry: number;
}

export interface LoginAlertEmailData {
  type: typeof EmailTypes.loginAlertEmail;
  email: string;
  fullname: string;
  loginInfo: {
    time: string;
    device: string;
    os: string;
    browser: string;
    location: {
      country: string;
      city: string;
    };
  };
}

export interface AccountRemovalEmailData {
  type: typeof EmailTypes.registrationBlockedEmail;
  email: string;
  fullname: string;
  expiry: number;
}
