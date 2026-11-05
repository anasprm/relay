import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  // Mock validation: token format user_id:timestamp
  try {
    const [userId, email, name] = Buffer.from(token, "base64").toString("utf-8").split(":");
    return NextResponse.json({
      user: {
        id: userId || "usr_1",
        email: email || "user@relay.pro",
        name: name || "Relay User",
        status: "online",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      }
    });
  } catch (e) {
    return NextResponse.json({
      user: {
        id: "usr_1",
        email: "user@relay.pro",
        name: "Relay User",
        status: "online",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      }
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, action } = body;
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const userId = "usr_" + Buffer.from(email).toString("hex").substring(0, 8);
    const name = email.split("@")[0];
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const tokenPayload = `${userId}:${email}:${capitalized}`;
    const token = Buffer.from(tokenPayload).toString("base64");

    return NextResponse.json({
      token,
      user: {
        id: userId,
        email,
        name: capitalized,
        status: "online",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Authentication failed" }, { status: 500 });
  }
}
