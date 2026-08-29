import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Project from '@/models/Project';
import { requireEvaluator, isValidObjectId } from '@/lib/auth-guard';
import { getOrSeedDefaultRubric } from '@/lib/activities';
import type { ICriterion } from '@/models/EvaluationCriteria';

/**
 * Create (or return) the evaluation record for a project assigned to the
 * current evaluator. EVALUATOR ONLY.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });
    if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });

    const project = await Project.findById(params.id).populate('owner', 'name email image');
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const isAssigned = project.assignedEvaluator?.toString() === user.id;
    if (!isAssigned) {
      return NextResponse.json({ error: 'This project is not assigned to you' }, { status: 403 });
    }

    let evaluation = await Evaluation.findOne({ project: params.id, evaluator: user.id });

    if (!evaluation) {
      const rubric = await getOrSeedDefaultRubric();
      // Pre-populate per-member score records so the evaluator can score each member.
      const memberIds = [project.owner._id.toString(), ...(project.members || []).map((m: any) => m._id?.toString() || m.toString())];
      const memberScores = Array.from(new Set(memberIds)).map((uid) => ({
        user: uid,
        scores: {} as Record<string, number>,
        comments: '',
        total: 0,
      }));
      evaluation = await Evaluation.create({
        project: params.id,
        evaluator: user.id,
        criteriaId: rubric._id,
        criteriaSnapshot: {
          name: rubric.name,
          totalMarks: rubric.totalMarks,
          criteria: rubric.criteria.map((c: ICriterion) => ({
            key: c.key,
            label: c.label,
            maxMarks: c.maxMarks,
            description: c.description,
          })),
        },
        memberScores,
        status: 'in_progress',
      });
    }

    return NextResponse.json({
      evaluation: {
        id: evaluation._id,
        status: evaluation.status,
        criteriaSnapshot: evaluation.criteriaSnapshot,
        memberScores: evaluation.memberScores,
        overallComments: evaluation.overallComments,
        finalizedAt: evaluation.finalizedAt,
        aiDraft: evaluation.aiDraft,
      },
    });
  } catch (error) {
    console.error('Create evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}