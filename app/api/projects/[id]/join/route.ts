import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Send join request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is already a member
    if (project.members.some((m: any) => m.toString() === session.user.id)) {
      return NextResponse.json({ error: 'You are already a member of this project' }, { status: 400 });
    }

    // Check if user is the owner
    if (project.owner.toString() === session.user.id) {
      return NextResponse.json({ error: 'You are the owner of this project' }, { status: 400 });
    }

    // Check if request already pending
    if (project.pendingRequests.some((m: any) => m.toString() === session.user.id)) {
      return NextResponse.json({ error: 'Join request already pending' }, { status: 400 });
    }

    // Add user to pending requests
    project.pendingRequests.push(session.user.id as any);
    await project.save();

    return NextResponse.json({ success: true, message: 'Join request sent' });
  } catch (error) {
    console.error('Join project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Cancel join request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Remove user from pending requests
    project.pendingRequests = project.pendingRequests.filter(
      (m: any) => m.toString() !== session.user.id
    );
    await project.save();

    return NextResponse.json({ success: true, message: 'Join request cancelled' });
  } catch (error) {
    console.error('Cancel join request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}