import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const { message } = await request.json();
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'A message is required' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Messages cannot exceed 5,000 characters' }, { status: 400 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.owner.toString() === session.user.id;
    const isMember = project.members.some(
      (member: mongoose.Types.ObjectId) => member.toString() === session.user.id
    );
    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
    }

    project.chatMessages.push({
      user: new mongoose.Types.ObjectId(session.user.id),
      message: text,
      timestamp: new Date(),
      mentions: [],
    } as any);
    await project.save();
    await project.populate('chatMessages.user', 'name email image');

    const saved = project.chatMessages[project.chatMessages.length - 1] as any;
    return NextResponse.json({
      message: {
        _id: saved._id,
        user: saved.user,
        message: saved.message,
        timestamp: saved.timestamp,
        mentions: saved.mentions || [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create chat message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
