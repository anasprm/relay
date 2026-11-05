import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, fullName, email, recoveryEmail } = body;

    const identifier = (username || email || "").trim();
    const displayName = (fullName || name || identifier).trim();

    if (!identifier) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if username is already taken (mock check for demo users)
    const takenUsernames = ["admin", "root", "support"];
    if (takenUsernames.includes(identifier.toLowerCase())) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    const isEmail = identifier.includes("@");
    const userEmail = isEmail ? identifier : (recoveryEmail || email || null);
    const cleanUsername = isEmail ? identifier.split("@")[0] : identifier;

    const userId = "usr_" + Buffer.from(identifier).toString("hex").substring(0, 8);
    const tokenPayload = `${userId}:${userEmail || cleanUsername}:${displayName}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json({
      token,
      user: {
        id: userId,
        username: cleanUsername,
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
