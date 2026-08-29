import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Task from '@/models/Task';
import { getAuthUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

/**
 * Tasks & milestones are PROJECT BUILDER features. Evaluators (and non-members)
 * are forbidden. Read access is granted to members/owner of the project.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await getUserProjectAccess(user.id, params.id, 'read');
    if (error) return NextResponse.json({ error: error.error }, { status: error.status });

    if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });

    const tasks = await Task.find({ project: params.id })
      .populate('assignedTo', 'name email image')
      .populate('createdBy', 'name email image')
      .sort({ createdAt: 1 });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('List tasks error:', error);
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
    const { title, description, status, priority, assignedTo, dueDate } = body;
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }
    if (assignedTo && !isValidObjectId(assignedTo)) {
      return NextResponse.json({ error: 'Invalid assignee id' }, { status: 400 });
    }

    const task = await Task.create({
      project: params.id,
      title: title.trim(),
      description: description || '',
      status: ['todo', 'in_progress', 'review', 'completed'].includes(status) ? status : 'todo',
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      assignedTo: assignedTo || undefined,
      createdBy: user.id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    await recordActivity({
      project: params.id,
      user: user.id,
      activityType: 'task_created',
      message: `Task created: "${task.title}"`,
      task: task._id.toString(),
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}