import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, inviteCode } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Optional invite code validation
    if (inviteCode && !["RELAY2026", "FAMILY", "WORKSPACE"].includes(inviteCode.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 400 }
      );
    }

    const userId = "usr_" + Buffer.from(username).toString("hex").substring(0, 8);
    const displayName = name || username.charAt(0).toUpperCase() + username.slice(1).split("@")[0];
    const email = username.includes("@") ? username : `${username}@relay.pro`;
    const tokenPayload = `${userId}:${email}:${displayName}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json({
      token,
      user: {
        id: userId,
        email,
        name: displayName,
        status: "online",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });
  } catch (e: any) {
    console.error("[Registration Error]", e.message);
    return NextResponse.json(
      { error: e.message || "Registration failed" },
      { status: 500 }
    );
  }
}
