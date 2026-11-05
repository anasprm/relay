import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const mockConversations = [
    {
      id: "room_general",
      name: "Engineering Core",
      type: "group",
      unreadCount: 2,
      lastMessage: {
        id: "m1",
        content: "Deploying Relay Messenger Pro v2 to production clusters now.",
        senderName: "Alex Mercer",
        timestamp: new Date().toISOString()
      },
      participants: [
        { id: "usr_1", name: "Alex Mercer", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", status: "online" },
        { id: "usr_2", name: "Elena Rostova", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", status: "online" }
      ]
    },
    {
      id: "room_design",
      name: "Glassmorphic UI Systems",
      type: "group",
      unreadCount: 0,
      lastMessage: {
        id: "m2",
        content: "The backdrop-filter blur gradients look immaculate.",
        senderName: "Elena Rostova",
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      participants: [
        { id: "usr_2", name: "Elena Rostova", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", status: "online" }
      ]
    },
    {
      id: "room_ai",
      name: "AI Copilot & Synapse",
      type: "direct",
      unreadCount: 1,
      lastMessage: {
        id: "m3",
        content: "Vector embeddings successfully indexed across all workspaces.",
        senderName: "Relay Copilot",
        timestamp: new Date(Date.now() - 7200000).toISOString()
      },
      participants: [
        { id: "usr_ai", name: "Relay Copilot", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150", status: "online" }
      ]
    }
  ];

  return NextResponse.json({ conversations: mockConversations });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, participants } = body;
    const newConv = {
      id: "room_" + Math.random().toString(36).substring(2, 9),
      name: name || "New Workspace Chat",
      type: type || "group",
      unreadCount: 0,
      participants: participants || []
    };
    return NextResponse.json({ conversation: newConv });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create conversation" }, { status: 500 });
  }
}
