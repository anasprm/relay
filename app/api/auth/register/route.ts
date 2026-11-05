import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, email, inviteCode } = body;

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

    const identifier = username.trim();
    const isEmail = identifier.includes("@");

    // Email is strictly optional — registration succeeds with username + password alone.
    const userEmail = isEmail ? identifier : (email || null);

    const userId = "usr_" + Buffer.from(identifier).toString("hex").substring(0, 8);
    const displayName =
      name || identifier.charAt(0).toUpperCase() + identifier.slice(1).split("@")[0];
    const tokenPayload = `${userId}:${userEmail || identifier}:${displayName}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json<AuthResponseData>({
      token,
      user: {
        id: userId,
        username: isEmail ? identifier.split("@")[0] : identifier,
        displayName,
        email: userEmail,
        status: "online",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });
  } catch (e: any) {
    console.error("[Registration Error]", e.message);
    return NextResponse.json(
      { error: e.message || "Sign up failed" },
      { status: 500 }
    );
  }
}
