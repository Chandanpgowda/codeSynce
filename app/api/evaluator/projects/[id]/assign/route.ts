import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { requireEvaluator, isValidObjectId } from '@/lib/auth-guard';
import { recordActivity } from '@/lib/activities';

/**
 * Evaluator claims a submitted project for evaluation.
 * Sets status SUBMITTED → UNDER_EVALUATION and assigns the evaluator.
 * EVALUATOR ONLY.
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

    const project = await Project.findById(params.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.status !== 'submitted') {
      return NextResponse.json(
        { error: `Project is not awaiting evaluation (current: ${project.status})` },
        { status: 400 }
      );
    }

    project.status = 'under_evaluation';
    project.assignedEvaluator = user.id as any;
    await project.save();

    await recordActivity({
      project: params.id,
      user: user.id,
      activityType: 'evaluation_started',
      message: `Evaluation started by ${user.name}`,
    });

    return NextResponse.json({ success: true, status: project.status });
  } catch (error) {
    console.error('Assign evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}