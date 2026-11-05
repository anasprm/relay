import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const mockStories = [
    {
      id: "story_1",
      userId: "usr_2",
      userName: "Elena Rostova",
      userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
      caption: "Glassmorphic design system v2 update ✨",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      viewsCount: 24,
      viewed: false
    },
    {
      id: "story_2",
      userId: "usr_3",
      userName: "Marcus Vance",
      userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      mediaUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600",
      caption: "High-throughput WebSocket cluster running smoothly ⚡",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      viewsCount: 42,
      viewed: true
    }
  ];

  return NextResponse.json({ stories: mockStories });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mediaUrl, caption } = body;
    const newStory = {
      id: "story_" + Math.random().toString(36).substring(2, 9),
      userId: "usr_1",
      userName: "Alex Mercer",
      userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      mediaUrl: mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
      caption: caption || "",
      timestamp: new Date().toISOString(),
      viewsCount: 0,
      viewed: false
    };
    return NextResponse.json({ story: newStory });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to post story" }, { status: 500 });
  }
}
