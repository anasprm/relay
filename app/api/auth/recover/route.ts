import { NextResponse } from "next/server";
import type { RecoveryResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email }: { email: string } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid recovery email is required" },
        { status: 400 }
      );
    }

    // Simulate sending a password reset link via email.
    // In production, integrate with a transactional email provider (Resend, SendGrid, etc.)
    // and generate a secure, time-limited reset token.
    const recoveryId = "rec_" + Buffer.from(email + Date.now()).toString("hex").substring(0, 12);

    console.log(`[Recovery] Password reset link sent to: ${email} (recoveryId: ${recoveryId})`);

    return NextResponse.json<RecoveryResponse>({
      message: "If an account exists with that email, a password reset link has been sent.",
      recoveryId,
    });
  } catch (e: any) {
    console.error("[Recovery Error]", e.message);
    return NextResponse.json(
      { error: e.message || "Recovery request failed" },
      { status: 500 }
    );
  }
}
