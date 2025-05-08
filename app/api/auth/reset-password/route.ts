import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/bcryptHelper";

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json();

    const hashedpassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { hashedpassword },
    });

    return new Response(
      JSON.stringify({ message: "Password reset successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
