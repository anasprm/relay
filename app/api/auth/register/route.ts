import { NextResponse } from "next/server";
import {
  createSessionToken,
  createUser,
  findUserByEmail,
  findUserByIdentifier,
  toApiUser,
} from "@/lib/server/authStore";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, fullName, email, recoveryEmail } = body;

    const identifier = (username || email || "").trim();
    const displayName = (fullName || name || identifier).trim();
    const rawEmail = (email || recoveryEmail || "").trim();

    if (!identifier) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const isEmailIdentifier = identifier.includes("@");
    const userEmail = isEmailIdentifier ? identifier : rawEmail || null;

    if (userEmail && !EMAIL_PATTERN.test(userEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const cleanUsername = isEmailIdentifier
      ? identifier.split("@")[0]
      : identifier;

    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 },
      );
    }

    const usernameTaken = findUserByIdentifier(cleanUsername);
    if (usernameTaken) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }

    if (userEmail) {
      const emailTaken = findUserByEmail(userEmail);
      if (emailTaken) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 },
        );
      }
    }

    const user = createUser({
      username: cleanUsername,
      email: userEmail,
      displayName: displayName || cleanUsername,
      password,
    });

    return NextResponse.json({
      token: createSessionToken(user),
      user: toApiUser(user),
    });
  } catch (e: any) {
    process.stderr.write(`[register] ${e?.message || String(e)}\n`);
    return NextResponse.json(
      { error: e.message || "Sign up failed" },
      { status: 500 },
    );
  }
}
