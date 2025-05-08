import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/bcryptHelper";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.hashedpassword) {
      return new Response(
        JSON.stringify({ error: "User not found or no password set" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValid = await comparePassword(password, user.hashedpassword);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate a JWT token with a 1-hour expiry
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    return new Response(
      JSON.stringify({ message: "Sign in successful", token }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
