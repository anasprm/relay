import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username or email and password are required" },
        { status: 400 }
      );
    }

    // Accept either an email address or a plain username as the identifier.
    // In production, look up the user by email OR username in the database.
    const identifier = username.trim();
    const isEmail = identifier.includes("@");

    // Mock authentication — accepts demo accounts by email or username
    const validIdentifiers = [
      "alex@relay.pro",
      "alex",
      "demo@relay.pro",
      "demo",
      "mercer",
    ];

    if (!validIdentifiers.includes(identifier.toLowerCase()) && password.length < 6) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const userId = "usr_" + Buffer.from(identifier).toString("hex").substring(0, 8);
    const displayName =
      identifier.charAt(0).toUpperCase() + identifier.slice(1).split("@")[0];
    const email = isEmail ? identifier : `${identifier}@relay.pro`;
    const tokenPayload = `${userId}:${email}:${displayName}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json({
      token,
      user: {
        id: userId,
        username: isEmail ? identifier.split("@")[0] : identifier,
        displayName,
        email,
        status: "online",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Login failed" },
      { status: 500 }
    );
  }
}
