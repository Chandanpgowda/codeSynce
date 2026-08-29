import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Project from '@/models/Project';
import { requireEvaluator, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

const MAX_SCORES = 1000; // arbitrary anti-abuse bound

/** Ensure the requested evaluation belongs to this evaluator + project. */
async function loadOwnedEvaluation(evaluatorId: string, projectId: string, evalId: string) {
  if (!isValidObjectId(evalId)) return null;
  return Evaluation.findOne({ _id: evalId, project: projectId, evaluator: evaluatorId });
}

// PATCH /api/projects/[id]/evaluation/[evalId]
// Save scores + comments for individual members (draft, non-final).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; evalId: string } }
) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });

    const evaluation = await loadOwnedEvaluation(user.id, params.id, params.evalId);
    if (!evaluation) return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    if (evaluation.status === 'finalized') {
      return NextResponse.json({ error: 'This evaluation is finalized and locked' }, { status: 403 });
    }

    const body = await request.json();
    const { memberScores, overallComments, aiDraft } = body;

    if (overallComments !== undefined) {
      evaluation.overallComments = String(overallComments).slice(0, 5000);
    }

    if (Array.isArray(memberScores)) {
      for (const incoming of memberScores) {
        const member = (evaluation.memberScores as any[]).find(
          (m) => m.user.toString() === (incoming.userId || incoming.user)
        );
        if (!member) continue;
        if (incoming.scores && typeof incoming.scores === 'object') {
          const scores = { ...member.scores };
          for (const [key, val] of Object.entries(incoming.scores)) {
            const num = Number(val);
            if (Number.isFinite(num) && num >= 0) {
              scores[key] = Math.min(num, MAX_SCORES);
            }
          }
          member.scores = scores;
        }
        if (typeof incoming.comments === 'string') {
          member.comments = incoming.comments.slice(0, 5000);
        }
      }
      // Recompute totals as the sum of criterion scores.
      evaluation.memberScores.forEach((member: any) => {
        member.total = Object.values(member.scores || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      });
    }

    // AI draft is advisory ONLY — stored explicitly flagged as AI-generated.
    if (aiDraft && (aiDraft.suggestedScores || aiDraft.reasoning)) {
      evaluation.aiDraft = {
        suggestedScores: aiDraft.suggestedScores || {},
        reasoning: aiDraft.reasoning || '',
        generatedAt: new Date(),
      };
    }

    await evaluation.save();
    return NextResponse.json({
      evaluation: {
        id: evaluation._id,
        status: evaluation.status,
        memberScores: evaluation.memberScores,
        overallComments: evaluation.overallComments,
        aiDraft: evaluation.aiDraft,
      },
    });
  } catch (error) {
    console.error('Update evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/evaluation/[evalId]  (body: { action: 'finalize' })
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; evalId: string } }
) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });

    const evaluation = await loadOwnedEvaluation(user.id, params.id, params.evalId);
    if (!evaluation) return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    if (evaluation.status === 'finalized') {
      return NextResponse.json({ error: 'Evaluation already finalized' }, { status: 400 });
    }

    const project = await Project.findById(params.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    evaluation.status = 'finalized';
    evaluation.finalizedAt = new Date();
    await evaluation.save();

    project.status = 'evaluated';
    await project.save();

    await recordActivity({
      project: params.id,
      user: user.id,
      activityType: 'evaluation_finalized',
      message: `Evaluation finalized (${evaluation.memberScores.length} member(s))`,
    });

    return NextResponse.json({ success: true, status: 'finalized' });
  } catch (error) {
    console.error('Finalize evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}