import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") || "room_general";

  const mockMessages = [
    {
      id: "msg_1",
      roomId,
      senderId: "usr_2",
      senderName: "Elena Rostova",
      senderAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      content: "Welcome to Relay Messenger Pro! The spatial glassmorphic architecture is fully active.",
      timestamp: new Date(Date.now() - 10000000).toISOString(),
      reactions: { "🔥": 3, "💎": 2 },
      status: "read"
    },
    {
      id: "msg_2",
      roomId,
      senderId: "usr_1",
      senderName: "Alex Mercer",
      senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      content: "All real-time socket events, IndexedDB offline caching, and WebRTC audio notes are fully functional.",
      timestamp: new Date(Date.now() - 5000000).toISOString(),
      reactions: { "🚀": 4 },
      status: "read"
    }
  ];

  return NextResponse.json({ messages: mockMessages });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, content, attachment, audioUrl } = body;
    
    const message = {
      id: "msg_" + Math.random().toString(36).substring(2, 9),
      roomId: roomId || "room_general",
      senderId: "usr_1",
      senderName: "Alex Mercer",
      senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      content: content || "",
      attachment: attachment || null,
      audioUrl: audioUrl || null,
      timestamp: new Date().toISOString(),
      reactions: {},
      status: "sent"
    };

    return NextResponse.json({ message });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to send message" }, { status: 500 });
  }
}
