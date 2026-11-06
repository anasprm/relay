import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/server/authStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { token?: unknown; password?: unknown; newPassword?: unknown }
      | null;

    const token =
      typeof body?.token === "string" ? body.token.trim() : "";
    const password =
      typeof body?.password === "string"
        ? body.password
        : typeof body?.newPassword === "string"
          ? body.newPassword
          : "";

    if (!token) {
      return NextResponse.json(
        { error: "A password reset token is required." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const user = consumePasswordResetToken(token, password);

    if (!user) {
      return NextResponse.json(
        {
          error:
            "This reset link is invalid or has expired. Please request a new one.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Password updated successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    process.stderr.write(
      `[reset-password] ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return NextResponse.json(
      { error: "Unable to reset the password. Please try again." },
      { status: 500 },
    );
  }
}
