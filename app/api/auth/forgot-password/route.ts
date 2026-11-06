import { NextResponse } from "next/server";
import {
  findUserByIdentifier,
  issuePasswordResetToken,
} from "@/lib/server/authStore";
import { sendPasswordResetEmail } from "@/lib/server/email";

export const runtime = "nodejs";

function resolveAppUrl(request: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const raw =
      (body as Record<string, unknown>).identifier ??
      (body as Record<string, unknown>).email ??
      (body as Record<string, unknown>).username;

    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json(
        { error: "Please enter your username or email address." },
        { status: 400 },
      );
    }

    const identifier = raw.trim();
    const user = findUserByIdentifier(identifier);

    if (!user) {
      return NextResponse.json(
        { error: "No account found with that email or username." },
        { status: 404 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          error:
            "This account does not have an email address on file, so a reset link cannot be sent.",
        },
        { status: 400 },
      );
    }

    const issued = issuePasswordResetToken(user.id);
    if (!issued) {
      return NextResponse.json(
        { error: "Could not create a reset link. Please try again." },
        { status: 500 },
      );
    }

    const resetUrl = `${resolveAppUrl(request)}/reset-password?token=${encodeURIComponent(
      issued.token,
    )}`;

    const delivery = await sendPasswordResetEmail({
      to: user.email,
      username: user.displayName || user.username,
      resetUrl,
    });

    // Expose the link in the response only outside production. In production
    // the link is available in the server logs when email is not configured.
    const devResetUrl =
      delivery.provider === "development" &&
      process.env.NODE_ENV !== "production"
        ? resetUrl
        : undefined;

    return NextResponse.json({
      success: true,
      message: delivery.delivered
        ? `Password reset link sent to ${user.email}.`
        : "Password reset requested. Check the server logs for the development reset link.",
      ...(devResetUrl ? { devResetUrl } : {}),
    });
  } catch (error) {
    process.stderr.write(
      `[forgot-password] ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return NextResponse.json(
      { error: "Unable to process the password reset. Please try again." },
      { status: 500 },
    );
  }
}
