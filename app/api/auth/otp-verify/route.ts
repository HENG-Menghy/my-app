import { prisma } from "@/lib/prisma";
import { isOtpExpired } from "@/lib/otpGenerator";

export async function POST(request: Request) {
  try {
    const { email, otpCode } = await request.json();

    const otpRecord = await prisma.emailOtpVerification.findFirst({
      where: { email, otpCode, used: false },
    });

    if (!otpRecord || isOtpExpired(otpRecord.expiresAt)) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await prisma.emailOtpVerification.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    return new Response(
      JSON.stringify({ message: "OTP verified" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
