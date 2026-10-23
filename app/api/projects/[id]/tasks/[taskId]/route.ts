import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Task from '@/models/Task';
import { getAuthUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'builder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { project, error } = await getUserProjectAccess(user.id, params.id, 'write');
    if (error || !project) return NextResponse.json({ error: error?.error || 'Forbidden' }, { status: error?.status || 403 });
    if (!isValidObjectId(params.taskId)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });

    const task = await Task.findOneAndDelete({ _id: params.taskId, project: params.id });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/:id/tasks (updates by id) and PUT alias.
export async function PATCH(
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
    const { taskId, title, description, status, priority, assignedTo, dueDate } = body;
    if (!taskId || !isValidObjectId(taskId)) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task: any = await Task.findOne({ _id: taskId, project: params.id });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) {
      task.status = status;
      if (status === 'completed' && !task.completedAt) task.completedAt = new Date();
      if (status !== 'completed') task.completedAt = undefined;
    }
    if (priority !== undefined) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo ? assignedTo : undefined;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : undefined;

    await task.save();

    // Evidence events
    const wasAssigned = body.assignedTo !== undefined && task.assignedTo;
    if (status === 'completed') {
      await recordActivity({
        project: params.id,
        user: user.id,
        activityType: 'task_completed',
        message: `Task completed: "${task.title}"`,
        task: task._id.toString(),
      });
    } else if (wasAssigned) {
      await recordActivity({
        project: params.id,
        user: user.id,
        activityType: 'task_assigned',
        message: `Task assigned: "${task.title}"`,
        task: task._id.toString(),
      });
    } else if (body.status !== undefined || body.title !== undefined) {
      await recordActivity({
        project: params.id,
        user: user.id,
        activityType: 'task_updated',
        message: `Task updated: "${task.title}"`,
        task: task._id.toString(),
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email image')
      .populate('createdBy', 'name email image');
    return NextResponse.json({ task: populated });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export { PATCH as PUT };