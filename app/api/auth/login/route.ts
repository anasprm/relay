import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Mock authentication - validate against demo credentials
    // In production, verify against a secure database with hashed passwords
    const validUsername = username.toLowerCase();
    const isDemoAccount =
      validUsername === "alex@relay.pro" ||
      validUsername === "alex" ||
      validUsername === "demo@relay.pro" ||
      validUsername === "demo";

    if (!isDemoAccount && password.length < 6) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const userId = "usr_" + Buffer.from(username).toString("hex").substring(0, 8);
    const name =
      username.charAt(0).toUpperCase() + username.slice(1).split("@")[0];
    const email = username.includes("@") ? username : `${username}@relay.pro`;
    const tokenPayload = `${userId}:${email}:${name}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json({
      token,
      user: {
        id: userId,
        email,
        name,
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
