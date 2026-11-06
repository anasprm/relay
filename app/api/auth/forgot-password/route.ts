import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email or username is required" },
        { status: 400 }
      );
    }

    // In a production app, this would look up the user by email/username
    // and send a password reset email with a secure, time-limited token.
    // For now, we simulate a successful response.
    console.log(`[Password Reset] Reset requested for: ${email}`);

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to process reset request" },
      { status: 500 }
    );
  }
}
