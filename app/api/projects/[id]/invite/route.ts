import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await Project.findById(params.id).select('+inviteToken +inviteExpiresAt');
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (project.owner.toString() !== session.user.id) return NextResponse.json({ error: 'Only the owner can create invite links' }, { status: 403 });

  project.inviteToken = randomBytes(32).toString('hex');
  project.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await project.save();
  return NextResponse.json({ token: project.inviteToken, expiresAt: project.inviteExpiresAt });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await request.json();
  const project = await Project.findById(params.id).select('+inviteToken +inviteExpiresAt');
  if (!project || !token || project.inviteToken !== token || !project.inviteExpiresAt || project.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite link is invalid or has expired' }, { status: 400 });
  }
  if (project.owner.toString() === session.user.id) return NextResponse.json({ success: true, message: 'You already own this project' });
  if (!project.members.some((member: import('mongoose').Types.ObjectId) => member.toString() === session.user.id)) {
    project.members.push(session.user.id as any);
    project.memberPermissions.set(session.user.id, 'editor');
    await project.save();
    await User.findByIdAndUpdate(session.user.id, { $addToSet: { projectsJoined: project._id } });
  }
  return NextResponse.json({ success: true, projectId: project._id });
}
