import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Mock upload storing and returning public URL
    const url = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800`;
    return NextResponse.json({ url, filename: file.name, size: file.size, type: file.type });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}
