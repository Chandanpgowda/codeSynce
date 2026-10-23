import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import { requireUser, getUserProjectAccess, isValidObjectId } from '@/lib/auth-guard';

/**
 * Evaluation results for PROJECT MEMBERS (owner + collaborators).
 * Only available once the evaluation has been finalized. Read-only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { user, error } = await requireUser();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });
    if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });

    // Membership check (owner or member). Public read access is NOT enough to
    // see evaluation results — only actual project members may view them.
    const access = await getUserProjectAccess(user.id, params.id, 'read');
    if (access.error || !access.project) {
      return NextResponse.json({ error: access.error?.error || 'Not found' }, { status: access.error?.status || 404 });
    }
    const p = access.project as any;
    const isOwner = p.owner?._id?.toString() === user.id;
    const isMember = (p.members || []).some((m: any) => m._id?.toString() === user.id);
    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Only project members can view evaluation results' }, { status: 403 });
    }

    const evaluation = await Evaluation.findOne({ project: params.id, status: 'finalized' })
      .populate('evaluator', 'name email image')
      .populate('memberScores.user', 'name email image')
      .lean();

    if (!evaluation) {
      return NextResponse.json({ evaluated: false });
    }

    const anyEval = evaluation as any;
    return NextResponse.json({
      evaluated: true,
      result: {
        finalizedAt: anyEval.finalizedAt,
        evaluator: anyEval.evaluator
          ? { name: anyEval.evaluator.name, image: anyEval.evaluator.image }
          : null,
        rubric: {
          name: anyEval.criteriaSnapshot?.name,
          totalMarks: anyEval.criteriaSnapshot?.totalMarks,
          criteria: anyEval.criteriaSnapshot?.criteria || [],
        },
        memberScores: (anyEval.memberScores || []).map((m: any) => ({
          user: { _id: m.user?._id, name: m.user?.name, image: m.user?.image },
          scores: m.scores || {},
          comments: m.comments || '',
          total: m.total || 0,
        })),
        overallComments: anyEval.overallComments || '',
      },
    });
  } catch (error) {
    console.error('Evaluation results error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
