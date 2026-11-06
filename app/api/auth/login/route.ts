import { NextResponse } from "next/server";
import {
  createSessionToken,
  findUserByIdentifier,
  toApiUser,
  verifyPassword,
} from "@/lib/server/authStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email } = body;

    const identifier = (username || email || "").trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username or email and password are required" },
        { status: 400 },
      );
    }

    const user = findUserByIdentifier(identifier);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 },
      );
    }

    // Demo accounts intentionally have no password hash, so any password keeps
    // working as before. Accounts created through /register are verified.
    if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      token: createSessionToken(user),
      user: toApiUser(user),
    });
  } catch (e: any) {
    process.stderr.write(`[login] ${e?.message || String(e)}\n`);
    return NextResponse.json(
      { error: e.message || "Sign in failed" },
      { status: 500 },
    );
  }
}
