import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Activity from '@/models/Activity';
import Task from '@/models/Task';
import Milestone from '@/models/Milestone';
import { requireEvaluator } from '@/lib/auth-guard';

/**
 * Individual + team contribution analytics derived from EVIDENCE (activities,
 * tasks, milestones). Multi-signal and advisory — never a perfect measure of
 * skill. Presented to the evaluator as "contribution evidence".
 *
 * EVALUATOR ONLY.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });

    const activities = await Activity.find({ project: params.id })
      .populate('user', 'name email image')
      .sort({ createdAt: -1 });

    const tasks = await Task.find({ project: params.id });
    const milestones = await Milestone.find({ project: params.id });

    type Member = { user: any; counts: Record<string, number>; files: Set<string>; events: any[] };
    const perUser: Record<string, Member> = {};

    for (const a of activities) {
      const u = a.user as any;
      const uid = u?._id?.toString();
      if (!uid) continue;
      if (!perUser[uid]) perUser[uid] = { user: u, counts: {}, files: new Set<string>(), events: [] };
      const p = perUser[uid];
      p.counts[a.activityType] = (p.counts[a.activityType] || 0) + 1;
      if (a.file) p.files.add(a.file);
      p.events.push({ id: a._id, activityType: a.activityType, message: a.message, file: a.file, createdAt: a.createdAt });
    }

    // Task attribution
    const tasksCreatedByUser: Record<string, number> = {};
    const tasksCompletedByUser: Record<string, number> = {};
    for (const t of tasks) {
      const c = t.createdBy?.toString();
      if (c) tasksCreatedByUser[c] = (tasksCreatedByUser[c] || 0) + 1;
    }
    for (const a of activities) {
      const u = (a.user as any)?._id?.toString();
      if (a.activityType === 'task_completed' && u) {
        tasksCompletedByUser[u] = (tasksCompletedByUser[u] || 0) + 1;
      }
    }

    const members = Object.values(perUser).map((p) => ({
      user: p.user,
      // Multi-signal evidence (never lines-of-code only):
      filesTouched: p.files.size,
      activities: p.counts,
      totalEvents: p.events.length,
      tasksCreated: tasksCreatedByUser[p.user._id?.toString()] ?? 0,
      tasksCompleted: tasksCompletedByUser[p.user._id?.toString()] ?? 0,
      events: p.events,
    }));

    const team = {
      totalEvents: activities.length,
      filesTouched: new Set(activities.filter((a) => a.file).map((a) => a.file)).size,
      tasksTotal: tasks.length,
      tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
      milestonesTotal: milestones.length,
      milestonesCompleted: milestones.filter((m) => m.status === 'completed').length,
    };

    return NextResponse.json({ members, team, milestones });
  } catch (error) {
    console.error('Contribution analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}