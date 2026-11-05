import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, email, name] = decoded.split(':');

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: userId,
        username: email ? email.split('@')[0] : 'user',
        fullName: name || 'Relay User',
        email: email || 'user@relay.pro',
        status: 'online',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Authentication check failed' }, { status: 401 });
  }
}
