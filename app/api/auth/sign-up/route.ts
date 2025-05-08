import { prisma } from "@/lib/prisma";
import { generateOtp } from "@/lib/otpGenerator";
import { sendOtpEmail } from "@/lib/emailService";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate OTP and create OTP record with a 30-second expiry
    const otpCode = generateOtp();
    await prisma.emailOtpVerification.create({
      data: { email, otpCode, expiresAt: new Date(Date.now() + 30 * 1000) },
    });

    // Send OTP email to user
    await sendOtpEmail(email, otpCode);

    return new Response(
      JSON.stringify({ message: "OTP sent to email" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
