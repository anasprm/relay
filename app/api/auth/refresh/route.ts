import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    // Issue a refreshed token (mock renewal)
    return NextResponse.json({
      success: true,
      token,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Token refresh failed' }, { status: 401 });
  }
}
