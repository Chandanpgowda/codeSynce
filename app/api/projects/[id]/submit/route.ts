import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Activity from '@/models/Activity';
import { getAuthUser, getUserProjectAccess } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

/**
 * A Project Builder submits the project for evaluation.
 * Only the project owner (or a builder member) may submit. Switches the
 * project status DRAFT → SUBMITTED and captures an evidence snapshot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { project, error } = await getUserProjectAccess(user.id, params.id, 'write');
    if (error || !project) {
      return NextResponse.json({ error: error?.error || 'Forbidden' }, { status: error?.status || 403 });
    }

    // Only builders may submit; evaluators cannot.
    if (user.role !== 'builder') {
      return NextResponse.json({ error: 'Forbidden: only project builders can submit' }, { status: 403 });
    }

    if (!['draft', 'submitted'].includes(project.status)) {
      return NextResponse.json(
        { error: `Project cannot be submitted from status "${project.status}"` },
        { status: 400 }
      );
    }

    // Build team snapshot from members + owner.
    const owner = project.owner as any;
    const members = await User.find({ _id: { $in: project.members } }).select('name').lean();
    const teamSnapshot = [
      { userId: owner._id.toString(), name: owner.name || 'Owner' },
      ...members.map((m: any) => ({ userId: m._id.toString(), name: m.name })),
    ];

    // File count.
    const countFiles = (nodes: any[]): number =>
      nodes.reduce((acc, n) => acc + (n.type === 'file' ? 1 : countFiles(n.children || [])), 0);
    const fileCount = countFiles(project.files || []);

    // Activity summary for evidence.
    const activityAgg = await Activity.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$activityType', count: { $sum: 1 } } },
    ]);
    const activitySummary: Record<string, number> = {};
    activityAgg.forEach((a) => (activitySummary[a._id] = a.count));

    project.status = 'submitted';
    project.submission = {
      submittedAt: new Date(),
      submittedBy: user.id as any,
      teamSnapshot: teamSnapshot as any,
      fileCount,
      activitySummary,
    };
    await project.save();

    await recordActivity({
      project: project._id.toString(),
      user: user.id,
      activityType: 'project_submitted',
      message: 'Project submitted for evaluation',
      metadata: { fileCount, status: 'submitted' },
    });

    return NextResponse.json({
      success: true,
      project: {
        _id: project._id,
        status: project.status,
        submission: project.submission,
      },
    });
  } catch (error) {
    console.error('Submit project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}