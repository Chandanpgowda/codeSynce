import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Milestone from '@/models/Milestone';
import { getAuthUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await getUserProjectAccess(user.id, params.id, 'read');
    if (error) return NextResponse.json({ error: error.error }, { status: error.status });

    const milestones = await Milestone.find({ project: params.id })
      .populate('createdBy', 'name email image')
      .sort({ order: 1 });
    return NextResponse.json({ milestones });
  } catch (error) {
    console.error('List milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'builder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { project, error } = await getUserProjectAccess(user.id, params.id, 'write');
    if (error || !project) return NextResponse.json({ error: error?.error || 'Forbidden' }, { status: error?.status || 403 });

    const body = await request.json();
    const { name, description, status, dueDate, order } = body;
    if (!name || !name.trim()) return NextResponse.json({ error: 'Milestone name is required' }, { status: 400 });

    const count = await Milestone.countDocuments({ project: params.id });
    const milestone = await Milestone.create({
      project: params.id,
      name: name.trim(),
      description: description || '',
      status: ['pending', 'in_progress', 'completed'].includes(status) ? status : 'pending',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdBy: user.id,
      order: order ?? count,
    });

    await recordActivity({
      project: params.id,
      user: user.id,
      activityType: 'milestone_created',
      message: `Milestone created: "${milestone.name}"`,
      milestone: milestone._id.toString(),
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error('Create milestone error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}