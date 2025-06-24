// @/services/emailService.ts

import { smtp } from "@/lib/email/config";
import { Logger } from "@/lib/logger";
import { AUTH_CONSTANTS } from "@/lib/auth/constants";
import type {
  EmailData,
  OTPEmailData,
  WelcomeEmailData,
  PasswordResetEmailData,
} from "@/types/email";
import { fromUTCToLocal } from "@/utils/datetime";

class EmailService {
  private retryAttempts = 3;
  private retryDelay = 2000; // 2 seconds

  private async sendWithRetry(
    mailOptions: EmailData,
    attempt = 1
  ): Promise<void> {
    try {
      // In development without force send, just log
      if (process.env.NODE_ENV === "development" && process.env.SMTP_FORCE_SEND !== "true") {
        Logger.debug("EMAIL_DEVELOPMENT_MODE", {
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          headers: {
            'X-Environment': process.env.NODE_ENV === 'development' ? 'Development' : 'Production',
            'X-Timestamp': fromUTCToLocal(new Date()).toFormat("yyyy LLL dd hh:mm:ss a"),
            'Message-ID': `${Date.now()}.${Math.random().toString(36).substring(2)}@${process.env.SMTP_HOST}`
          }
        });
        return;
      }

      // Attempt to send mail
      await smtp.sendMail({
        from: `${process.env.APP_NAME} <${process.env.SMTP_USER}>`,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        headers: {
          'X-Environment': process.env.NODE_ENV === 'development' ? 'Development' : 'Production',
          'X-Timestamp': fromUTCToLocal(new Date()).toFormat("yyyy LLL dd hh:mm:ss a"),
          'Message-ID': `${Date.now()}.${Math.random().toString(36).substring(2)}@${process.env.SMTP_HOST}`
        }
      });

    } catch (error) {
      Logger.error("EMAIL_SEND_ERROR", error as Error, {
        attempt,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      // Retry if we haven't exceeded max attempts
      if (attempt < this.retryAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
        return this.sendWithRetry(mailOptions, attempt + 1);
      }

      throw new Error("Failed to send email after multiple attempts");
    }
  }

  async sendVerificationEmail(
    email: string,
    otp: string,
    fullname?: string
  ): Promise<void> {
    const data: OTPEmailData = {
      email,
      otp,
      fullname,
      expiresInMinutes: AUTH_CONSTANTS.OTP_EXPIRY / 60,
    };

    await this.sendWithRetry({
      to: email,
      subject: "Verify Your Email Address",
      text: this.generateVerificationEmailText(data),
      html: this.generateVerificationEmailHtml(data),
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    await this.sendWithRetry({
      to: data.email,
      subject: `Welcome to ${process.env.APP_NAME}`,
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

  async sendAccountLockedEmail(email: string, fullname: string): Promise<void> {
    await this.sendWithRetry({
      to: email,
      subject: "Account Security Alert",
      text: this.generateAccountLockedEmailText(fullname),
      html: this.generateAccountLockedEmailHtml(fullname),
    });
  }

  async sendLoginAlertEmail(
    email: string,
    fullname: string,
    loginInfo: {
      time: string;
      ipAddress?: string
      userAgent?:string;
      location?: {
        country: string;
        city: string;
      }
      os?: string;
      browser?: string;
    }
  ): Promise<void> {
    await this.sendWithRetry({
      to: email,
      subject: "New Login Detected",
      text: this.generateLoginAlertEmailText(fullname, loginInfo),
      html: this.generateLoginAlertEmailHtml(fullname, loginInfo),
    });
  }

  private generateVerificationEmailHtml(data: OTPEmailData): string {
    const content = `
      <h2 class="title">Verify Your Email Address</h2>
      <p class="text">Hello there,</p>
      <p class="text">Use the code below to complete your sign-up process:</p>
      <div class="code">${data.otp}</div>
      <p class="text">The code is valid for <strong>${
        data.expiresInMinutes
      } minute</strong>.</p>
      <div class="alert">
        <strong>Security Tip:</strong> If you didn't request this code, you can safely ignore this message.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateVerificationEmailText(data: OTPEmailData): string {
    return `
Hello ${data.fullname || "there"},

Please use the following verification code to complete your registration:

${data.otp}

This code will expire in ${data.expiresInMinutes} minute.

Security Notice: If you didn't request this code, please ignore this email.

Best regards,
${process.env.APP_NAME} Team
    `.trim();
  }

  private generateWelcomeEmailHtml(data: WelcomeEmailData): string {
    const content = `
      <h2 class="title">Welcome to ${process.env.APP_NAME}!</h2>
      <p class="text">Hello ${data.fullname},</p>
      <p class="text">Thanks for signing up. Your account has been successfully created and now you can login to the platform.</p>
      <p class="text">Here’s what you can do with ${process.env.APP_NAME}:</p>
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
Welcome to ${process.env.APP_NAME}!

Hello ${data.fullname},

Thank you for joining ${process.env.APP_NAME}. Your account has been successfully created.

You can now login to our platform and can access features:
- Make or cancel a booking before it is approved 
- Request to cancel your booking after it has been approved
- View your booking history
- View your meeting history
- View or update your profile
- Change or reset password

Get started here: ${process.env.NEXT_PUBLIC_BASE_URL}

Best regards,
${process.env.APP_NAME} Team
    `.trim();
  }

  private generatePasswordResetEmailHtml(data: PasswordResetEmailData): string {
    const content = `
      <h2 class="title">Reset Your Password</h2>
      <p class="text">Hello ${data.fullname},</p>
      <p class="text">We received a request to reset your password.</p>
      <p class="text">Use the following code below to process resetting your password:</p>
      <div class="code"> ${data.resetCode} </div>
      <p class="text" style="margin-top: 20px;">
        This code will expire in ${data.expiresInMinutes} minute.
      </p>
      <div class="alert">
        <strong>Security Notice:</strong> If you didn’t request this reset, please contact our support team immediately.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generatePasswordResetEmailText(data: PasswordResetEmailData): string {
    return `
Hello ${data.fullname},

We received a request to reset your password.

Your password reset code is: ${data.resetCode}

This code will expire in ${data.expiresInMinutes} minute.

Security Notice: If you didn't request this password reset, please contact support immediately.

Best regards,
${process.env.APP_NAME} Team
    `.trim();
  }

  private generateAccountLockedEmailHtml(fullname: string): string {
    const content = `
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Account Security Alert</h2>
      <p style="margin: 0 0 12px;">Hello ${fullname},</p>
      <p style="margin: 0 0 12px;">Your account has been temporarily locked due to multiple failed login attempts.</p>
      <p style="margin: 0 0 12px;">If this was you, you can try again after 2 hours.</p>
      <p style="margin: 0 0 12px;">If you didn't attempt to log in, we recommend taking the following steps:</p>
      <ul style="margin: 0 0 12px 16px; padding: 0;">
        <li style="margin-bottom: 8px;">Change your password immediately</li>
        <li style="margin-bottom: 8px;">Review your recent account activity</li>
      </ul>
      <div style="
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        border-radius: 4px;
        margin-top: 20px;
      ">
        <strong>Need help?</strong> Contact our support team immediately if you notice any suspicious activity.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateAccountLockedEmailText(fullname: string): string {
    return `
Hello ${fullname},

Your account has been temporarily locked due to multiple failed login attempts.

If this was you, you can try again after 2 hours.

If you didn't attempt to log in, we recommend:
- Changing your password immediately
- Reviewing your recent account activity

Need help? Contact our support team immediately if you notice any suspicious activity.

Best regards,
${process.env.APP_NAME} Team
    `.trim();
  }

  private generateLoginAlertEmailHtml(
    fullname: string,
    loginInfo: {
      time: string;
      ipAddress?: string;
      userAgent?: string;
      location?:{
        country: string;
        city: string;
      }
      os?: string;
      browser?: string;
    }
  ): string {
    const content = `
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">New Login Detected</h2>
      <p style="margin: 0 0 12px;">Hello ${fullname},</p>
      <p style="margin: 0 0 12px;">We detected a new login to your account with the following details:</p>
      <ul style="margin: 0 0 12px 16px; padding: 0;">
        <li style="margin-bottom: 8px;">Time: ${fromUTCToLocal(loginInfo.time).toFormat("yyyy LLL dd hh:mm:ss a")}</li>
        ${
          loginInfo.ipAddress
            ? `<li style="margin-bottom: 8px;">IP Address: ${loginInfo.ipAddress}</li>`
            : ""
        }
        ${
          loginInfo.location
            ? `<li style="margin-bottom: 8px;">Location: ${loginInfo.location.city}, ${loginInfo.location.country}</li>`
            : ""
        }
        ${
          loginInfo.os
            ? `<li style="margin-bottom: 8px;">OS: ${loginInfo.os}</li>`
            : ""
        }
        ${
          loginInfo.browser
            ? `<li style="margin-bottom: 8px;">Browser: ${loginInfo.browser}</li>`
            : ""
        }
        ${
          loginInfo.userAgent
            ? `<li style="margin-bottom: 8px;">User Agent: ${loginInfo.userAgent}</li>`
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
        <strong>Wasn't you?</strong> If you don't recognize this login, please change your password immediately and contact support.
      </div>
    `;
    return this.generateEmailLayout(content);
  }

  private generateLoginAlertEmailText(
    fullname: string,
    loginInfo: {
      time: string;
      ipAddress?: string;
      userAgent?: string;
      location?:{
        country: string;
        city: string;
      }
      os?: string;
      browser?: string;
    }
  ): string {
    return `
Hello ${fullname},

We detected a new login to your account with the following details:

Time: ${fromUTCToLocal(loginInfo.time).toFormat("yyyy LLL dd hh:mm:ss a")}
${loginInfo.ipAddress ? `IP Address: ${loginInfo.ipAddress}` : ""}
${loginInfo.location ? `Location: ${loginInfo.location.city}, ${loginInfo.location.country}` : ""}
${loginInfo.os ? `OS: ${loginInfo.os}` : ""}
${loginInfo.browser ? `Browser: ${loginInfo.browser}` : ""}
${loginInfo.userAgent ? `UserAgent: ${loginInfo.userAgent}` : ""}

Security Notice: If you don't recognize this login, please change your password immediately and contact support.

Best regards,
${process.env.APP_NAME} Team
    `.trim();
  }

  private generateEmailLayout(content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${process.env.APP_NAME}</title>
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
              <h2 style="color: #3ecf8e;">${process.env.APP_NAME}</h2>
            </div>
            ${content}
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
              <p>© ${new Date().getFullYear()} ${
      process.env.APP_NAME
    }. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();