import { NextResponse } from "next/server";
import {
  createSessionToken,
  findUserByIdentifierOrEmail,
  toApiUser,
  verifyPassword,
} from "@/lib/server/authStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          identifier?: unknown;
          username?: unknown;
          email?: unknown;
          password?: unknown;
        }
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    // `identifier` is the canonical field. The other two are kept so older
    // clients and direct API calls continue to work.
    const rawIdentifier = body.identifier ?? body.username ?? body.email;
    const identifier =
      typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email or username and password are required." },
        { status: 400 },
      );
    }

    // Accept either a username or an email address.
    const user = await findUserByIdentifierOrEmail(identifier);

    if (!user) {
      return NextResponse.json(
        {
          error:
            "No account found with that email or username. Check your details or create an account.",
        },
        { status: 401 },
      );
    }

    // Seeded demo accounts have no password hash, so any password keeps
    // working as before. Accounts created through /register, or whose password
    // was changed through /reset-password, are verified normally.
    if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect password. Try again or reset it." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      token: createSessionToken(user),
      user: toApiUser(user),
    });
  } catch (error) {
    process.stderr.write(
      `[login] ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return NextResponse.json(
      { error: "Sign in failed. Please try again." },
      { status: 500 },
    );
  }
}
