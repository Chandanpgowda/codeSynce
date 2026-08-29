import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Activity from '@/models/Activity';
import Project from '@/models/Project';
import { getAuthUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';

/**
 * Evidence timeline for a project.
 * Accessible to members/owner of the project and to the assigned EVALUATOR.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });

    // Members/owner can read their own project's timeline.
    let access: { error: { error: string; status: number } | null } | null = null;
    const memberAccess = await getUserProjectAccess(user.id, params.id, 'read');
    if (memberAccess.error) {
      // Allow the assigned evaluator.
      const project = (await Project.findById(params.id).select('assignedEvaluator status').lean()) as any;
      const assigned = project?.assignedEvaluator?.toString() === user.id;
      const underReview =
        project && ['submitted', 'under_evaluation', 'evaluated'].includes(project.status);
      if (!assigned || !underReview) {
        return NextResponse.json(
          { error: memberAccess.error.error || 'Forbidden' },
          { status: memberAccess.error.status || 403 }
        );
      }
    }

    const activities = await Activity.find({ project: params.id })
      .populate('user', 'name email image')
      .sort({ createdAt: -1 })
      .limit(500);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Evidence timeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}