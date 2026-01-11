// @/services/emailService.ts

import { smtp } from "@/lib/email/config";
import { Logger } from "@/lib/logger";
import type {
  EmailData,
  VerificationEmailData,
  WelcomeEmailData,
  PasswordResetEmailData,
  LoginAlertEmailData,
  AccountRemovalEmailData,
} from "@/types/email";
import { fromUTCToLocal } from "@/utils/datetime";
import { getTimeDifference } from "@/utils/getTimeDifference";
import { maskEmail } from "@/utils/maskEmail";

class EmailService {
  private retryAttempts = 3;
  private retryDelay = 3000; // 3 seconds

  private async sendWithRetry(
    mailOptions: EmailData,
    attempt = 1
  ): Promise<void> {
    try {
      // In development without force send, just log
      if (
        process.env.NODE_ENV === "development" &&
        process.env.SMTP_FORCE_SEND === "false"
      ) {
        Logger.debug("EMAIL_DEVELOPMENT_MODE", {
          from: `${process.env.NEXT_PUBLIC_APP_NAME} <${process.env.SMTP_USER}>`,
          to: maskEmail(mailOptions.to),
          subject: mailOptions.subject,
          text: mailOptions.text,
          headers: {
            "X-Environment":
              process.env.NODE_ENV === "development"
                ? "Development"
                : "Production",
            "X-Timestamp": fromUTCToLocal(new Date()).toFormat(
              "yyyy-LLL-dd hh:mm:ss a"
            ),
            "Message-ID": `${Date.now()}-${Math.random()
              .toString(36)
              .substring(2)}@${process.env.SMTP_HOST}`,
          },
          actor: "System",
        });
        return;
      }

      // Attempt to send mail
      await smtp.sendMail({
        from: `${process.env.NEXT_PUBLIC_APP_NAME} <${process.env.SMTP_USER}>`,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
    } catch (error) {
      Logger.error("EMAIL_SERVICE_SEND_ERROR", error as Error, {
        attempt,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      // Retry if haven't exceeded max attempts
      if (attempt < this.retryAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
        return this.sendWithRetry(mailOptions, attempt + 1);
      }

      throw new Error("Failed to send email after multiple attempts");
    }
  }

  async sendVerificationEmail(data: VerificationEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: "Verify Your Email Address",
      text: this.generateVerificationEmailText(data),
      html: this.generateVerificationEmailHtml(data),
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}`,
      text: this.generateWelcomeEmailText(data),
      html: this.generateWelcomeEmailHtml(data),
    });
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: "Reset Your Password",
      text: this.generatePasswordResetEmailText(data),
      html: this.generatePasswordResetEmailHtml(data),
    });
  }

  async sendLoginAlertEmail(data: LoginAlertEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: "New Login Detected",
      text: this.generateLoginAlertEmailText(data),
      html: this.generateLoginAlertEmailHtml(data),
    });
  }

  async sendAccountRemovalEmail(data: AccountRemovalEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: "Account Removed",
      text: this.generateAccountRemovalEmailText(data),
      html: this.generateAccountRemovalEmailHtml(data),
    });
  }

  private generateVerificationEmailHtml(data: VerificationEmailData): string {
    const content = `
      <h2 class="title">Verify Your Email Address</h2>
      <p class="text">Hello there,</p>
      <p class="text">Use the code below to complete your sign-up process:</p>
      <div class="code">${data.otp}</div>
      <p class="text">The code is valid for <strong>${getTimeDifference(
        data.expiry
      )}</strong>. </p>
      <div class="alert">
        <strong>Security Notice:</strong> If you did not request this code, please ignore this email. No further action is required.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateVerificationEmailText(data: VerificationEmailData): string {
    return `
Hello there,
Please use the following verification code to complete your registration:
${data.otp}
This code will expire in ${getTimeDifference(data.expiry)}.
Security Notice: If you did not request this code, please ignore this email. No further action is required.
Best regards,
${process.env.NEXT_PUBLIC_APP_NAME} Team
    `.trim();
  }

  private generateWelcomeEmailHtml(data: WelcomeEmailData): string {
    const content = `
      <h2 class="title">Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}!</h2>
      <p class="text">Hello ${data.fullname},</p>
      <p class="text">Thanks for signing up. Your account has been successfully created and now you can login for your account.</p>
      <p class="text">Here’s what you can do with <strong> ${process.env.NEXT_PUBLIC_APP_NAME} </strong> web application:</p>
      <ul class="text" style="padding-left: 20px; margin-bottom: 16px;">
        <li>✔️ Make or cancel a booking before it is approved </li>
        <li>✔️ Request to cancel your booking after it has been approved </li>
        <li>✔️ View booking history </li>
        <li>✔️ View meeting history </li>
        <li>✔️ View or update profile </li>
        <li>✔️ Change or reset password </li>
      </ul>
      <divstyle="text-align: center; margin-top: 24px;">
        <a
          href="${process.env.NEXT_PUBLIC_BASE_URL}" 
          style="
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
          "
        >
          Get Started
        </a>
      </divstyle=>
    `;
    return this.generateEmailLayout(content);
  }

  private generateWelcomeEmailText(data: WelcomeEmailData): string {
    return `
Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}!
Hello ${data.fullname},
Thanks for your registering with ${process.env.NEXT_PUBLIC_APP_NAME}!
Your account has been successfully created. You can now log in and start using the platform.
Here are some features you can access:
- Make or cancel a booking before it is approved 
- Request to cancel your booking after it has been approved
- View your booking history
- View your meeting history
- View or update your profile
- Change or reset password
Get started here: ${process.env.NEXT_PUBLIC_BASE_URL}
Best regards,
${process.env.NEXT_PUBLIC_APP_NAME} Team
    `.trim();
  }

  private generatePasswordResetEmailHtml(data: PasswordResetEmailData): string {
    const content = `
      <h2 class="title">Reset Your Password</h2>
      <p class="text">Hello ${data.fullname},</p>
      <p class="text">We received a request to reset your password.</p>
      <p class="text">Use the following code below to process resetting your password:</p>
      <div class="code"> ${data.otp} </div>
      <p class="text" style="margin-top: 20px;">
        This code will expire in  ${getTimeDifference(data.expiry)}.
      </p>
      <div class="alert">
        <strong>Security Notice:</strong> If you did not request this code, you can safely ignore this message.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generatePasswordResetEmailText(data: PasswordResetEmailData): string {
    return `
Hello ${data.fullname},
We received a request to reset your password.
To reset your password, please use the following code: ${data.otp}
This code will expire in  ${getTimeDifference(data.expiry)}.
Security Notice: If you did not request this password reset, you can safely ignore this message.
Best regards,
${process.env.NEXT_PUBLIC_APP_NAME} Team
    `.trim();
  }

  private generateLoginAlertEmailHtml(data: LoginAlertEmailData): string {
    const {
      fullname,
      loginInfo: { time, device, os, browser, location },
    } = data;
    const content = `
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">New Login Detected</h2>
      <p style="margin: 0 0 12px;">Hello ${fullname},</p>
      <p style="margin: 0 0 12px;">We detected a new login to your account with the following details:</p>
      <ul style="margin: 0 0 12px 16px; padding: 0;">
        <li style="margin-bottom: 8px;">Time: ${fromUTCToLocal(time).toFormat(
          "yyyy-LLL-dd hh:mm:ss a"
        )}</li>
        ${
          location
            ? `<li style="margin-bottom: 8px;">Location: ${location.city}, ${location.country}</li>`
            : ""
        }
        ${
          os
            ? `<li style="margin-bottom: 8px;">Operating System: ${os}</li>`
            : ""
        }
        ${
          device ? `<li style="margin-bottom: 8px;">Device: ${device}</li>` : ""
        }
        ${
          browser
            ? `<li style="margin-bottom: 8px;">Browser: ${browser}</li>`
            : ""
        }
      </ul>
      <div style="
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        border-radius: 4px;
        margin-top: 20px;
      ">
        <strong>Wasn't you?</strong> If this login attempt was not made by you, we recommend resetting your password and ending any active sessions you do not recognize.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateLoginAlertEmailText(data: LoginAlertEmailData): string {
    const {
      fullname,
      loginInfo: { time, device, os, browser, location },
    } = data;
    return `
Hello ${fullname},
We detected a new login to your account with the following details:
Time: ${fromUTCToLocal(time).toFormat("yyyy-LLL-dd hh:mm:ss a")}
${location ? `Location: ${location.city}, ${location.country}` : ""}
${os ? `Operating System: ${os}` : ""}
${device ? `Device: ${device}` : ""}
${browser ? `Browser: ${browser}` : ""}
If this login attempt was not made by you, we recommend resetting your password and ending any active sessions you do not recognize.
Best regards,
${process.env.NEXT_PUBLIC_APP_NAME} Team
    `.trim();
  }

  private generateAccountRemovalEmailHtml(data: AccountRemovalEmailData): string {
    const content = `
      <h2 class="title">Account Removed</h2>
      <p class="text">Hello ${data.fullname},</p>
      <p class="text">Your account has been removed from our system.</p>
      <div class="alert">
        <strong>Notice:</strong> 
        You may register a new account with this email after ${getTimeDifference(
          data.expiry
        )}.
        }
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateAccountRemovalEmailText(data: AccountRemovalEmailData): string {
    return `
Hello ${data.fullname},
Your account has been removed from our system.
 You may register a new account with this email after ${getTimeDifference(
   data.expiry
 )}.
}
    `.trim();
  }

  private generateEmailLayout(content: string): string {
    const logoUrl =
      "https://zlowucgjecrlilkyoamr.supabase.co/storage/v1/object/public/images-bucket/logo.png";
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${process.env.NEXT_PUBLIC_APP_NAME}</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f9f9f9;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              width: 100%;
              margin: 0 auto;
              padding: 24px;
              background-color: #ffffff;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
              border-radius: 8px;
            }
            .header {
              text-align: center;
              padding-bottom: 16px;
              border-bottom: 1px solid #eaeaea;
            }
            .title {
              font-size: 24px;
              margin-bottom: 16px;
              color: #111827;
            }
            .text {
              font-size: 16px;
              margin-bottom: 12px;
              color: #374151;
            }
            .code {
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 6px;
              padding: 16px;
              text-align: center;
              background-color: #f3f4f6;
              border-radius: 8px;
              margin: 24px 0;
              color: #1f2937;
            }
            .alert {
              background-color: #fffbea;
              border-left: 4px solid #facc15;
              padding: 16px;
              border-radius: 6px;
              font-size: 14px;
              color: #92400e;
              margin-top: 24px;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
            }
            @media only screen and (max-width: 640px) {
              .container {
                padding: 16px;
                border-radius: 0;
                box-shadow: none;
              }
              .code {
                font-size: 24px;
                letter-spacing: 4px;
              }
              .title {
                font-size: 20px;
              }
              .text, .alert {
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="System Logo" style="width: 208px; height: auto;" />
            </div>
            ${content}
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
              <p>© ${new Date().getFullYear()} ${
      process.env.NEXT_PUBLIC_APP_NAME
    }. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
