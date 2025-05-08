import nodemailer from "nodemailer";

const createTestTransporter = async () => {
  // Generate a test SMTP account instead of using real credentials
  const testAccount = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
};

export const sendOtpEmail = async (email: string, otpCode: string) => {
  // For development, use Ethereal. For production, you use safer service,
  // dedicated provider if process.env.NODE_ENV === "production"
  let transporter;
  if (process.env.NODE_ENV === "production") {
    transporter = nodemailer.createTransport({
      service: "Gmail", // or preferred service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    transporter = await createTestTransporter();
  }

  const info = await transporter.sendMail({
    from: '"No Reply" <no-reply@example.com>',
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otpCode}. It is valid for 30 seconds.`,
  });

  // Log the preview URL only in development so you can view the fake email in your browser
  if (process.env.NODE_ENV !== "production") {
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
};
