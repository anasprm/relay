import { NextResponse } from "next/server";
import {
  findUserById,
  findUserByIdentifier,
  parseSessionToken,
  toApiUser,
} from "@/lib/server/authStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const parsed = parseSessionToken(token);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Resolve the current record so profile changes and password resets are
    // reflected immediately. Fall back to the token payload for old sessions.
    const user =
      findUserById(parsed.userId) ||
      (parsed.email ? findUserByIdentifier(parsed.email) : null);

    if (user) {
      return NextResponse.json({ user: toApiUser(user) });
    }

    return NextResponse.json({
      user: {
        id: parsed.userId,
        username: parsed.email ? parsed.email.split("@")[0] : "user",
        displayName: parsed.displayName || "Relay User",
        fullName: parsed.displayName || "Relay User",
        email: parsed.email || "user@relay.pro",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        avatarUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        accent: "cyan",
        status: "online",
        online: true,
        lastSeen: null,
        discoverable: true,
      },
    });
  } catch (e: any) {
    process.stderr.write(`[me] ${e?.message || String(e)}\n`);
    return NextResponse.json(
      { error: e.message || "Authentication check failed" },
      { status: 401 },
    );
  }
}
