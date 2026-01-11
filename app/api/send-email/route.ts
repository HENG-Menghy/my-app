// @/api/send-email/route.ts

import { ApiResponse } from "@/lib/api/response";
import { validateRequest } from "@/lib/api/validate";
import { Logger } from "@/lib/logger";
import { EmailRequest, EmailRequestSchema } from "@/lib/validations/emailSendingSchemas";
import { emailService } from "@/services/emailService";
import {
  AccountRemovalEmailData,
  EmailTypes,
  LoginAlertEmailData,
  VerificationEmailData,
  PasswordResetEmailData,
  WelcomeEmailData,
} from "@/types/email";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data: EmailRequest = await validateRequest(EmailRequestSchema, body);
    switch (data.type) {
      case EmailTypes.welcomeEmail:
        await emailService.sendWelcomeEmail(data as WelcomeEmailData);
        break;
      case EmailTypes.verificationEmail:
        await emailService.sendVerificationEmail(data as VerificationEmailData);
        break;
      case EmailTypes.loginAlertEmail:
        await emailService.sendLoginAlertEmail(data as LoginAlertEmailData);
        break;
      case EmailTypes.passwordResetEmail:
        await emailService.sendPasswordResetEmail(
          data as PasswordResetEmailData
        );
        break;
      case EmailTypes.registrationBlockedEmail:
        await emailService.sendAccountRemovalEmail(
          data as AccountRemovalEmailData
        );
        break;
      default:
        return ApiResponse.error(new Error("Unknown email sending type"));
    }
    return ApiResponse.success({
      message: "[QStash Background Jobs] Email was sent successfully",
    });
  } catch (error) {
    Logger.error("QSTASH_BACKGROUND_JOBS_ERROR", error as Error);
    return ApiResponse.error(error);
  }
}
