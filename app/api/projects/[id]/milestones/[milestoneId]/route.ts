import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Milestone from '@/models/Milestone';
import { getAuthUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; milestoneId: string } }
) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'builder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { project, error } = await getUserProjectAccess(user.id, params.id, 'write');
    if (error || !project) return NextResponse.json({ error: error?.error || 'Forbidden' }, { status: error?.status || 403 });
    if (!isValidObjectId(params.milestoneId)) return NextResponse.json({ error: 'Invalid milestone id' }, { status: 400 });

    const body = await request.json();
    const milestone: any = await Milestone.findOne({ _id: params.milestoneId, project: params.id });
    if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    if (body.name !== undefined) milestone.name = body.name;
    if (body.description !== undefined) milestone.description = body.description;
    if (body.status !== undefined) {
      milestone.status = body.status;
      if (body.status === 'completed' && !milestone.completedAt) milestone.completedAt = new Date();
      if (body.status !== 'completed') milestone.completedAt = undefined;
    }
    if (body.dueDate !== undefined) milestone.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.order !== undefined) milestone.order = body.order;

    await milestone.save();

    const completed = body.status === 'completed';
    await recordActivity({
      project: params.id,
      user: user.id,
      activityType: completed ? 'milestone_completed' : 'other',
      message: completed ? `Milestone completed: "${milestone.name}"` : `Milestone updated: "${milestone.name}"`,
      milestone: milestone._id.toString(),
    });

    return NextResponse.json({ milestone });
  } catch (error) {
    console.error('Update milestone error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; milestoneId: string } }
) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'builder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { project, error } = await getUserProjectAccess(user.id, params.id, 'write');
    if (error || !project) return NextResponse.json({ error: error?.error || 'Forbidden' }, { status: error?.status || 403 });

    await Milestone.findOneAndDelete({ _id: params.milestoneId, project: params.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete milestone error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export { PATCH as PUT };