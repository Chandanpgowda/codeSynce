import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get user notifications
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const query: any = { user: session.user.id };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate('fromUser', 'name email image')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, all } = body;

    if (all) {
      await Notification.updateMany(
        { user: session.user.id, read: false },
        { $set: { read: true } }
      );
      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await Notification.updateMany(
        { _id: { $in: ids }, user: session.user.id },
        { $set: { read: true } }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No notification IDs provided' }, { status: 400 });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete all notifications
export async function DELETE() {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await Notification.deleteMany({ user: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}