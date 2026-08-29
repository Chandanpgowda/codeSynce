import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import Activity from '@/models/Activity';
import Task from '@/models/Task';
import Milestone from '@/models/Milestone';
import Evaluation from '@/models/Evaluation';
import EvaluationCriteria from '@/models/EvaluationCriteria';
import { requireEvaluator, isValidObjectId } from '@/lib/auth-guard';
import { getOrSeedDefaultRubric } from '@/lib/activities';

/**
 * Read-only, full evaluation workspace data for a project assigned to the
 * evaluator. Includes overview, team, evidence timeline + code (read-only),
 * tasks, milestones, existing evaluation and rubric.
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
    if (!isValidObjectId(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });

    const project = await Project.findById(params.id)
      .populate('owner', 'name email image')
      .populate('members', 'name email image')
      .populate('assignedEvaluator', 'name email image')
      .populate('chatMessages.user', 'name email image');

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Assigned evaluators get the full workspace. Unclaimed submitted projects
    // are visible to any evaluator (they appear on the dashboard) — load them
    // read-only with claimable=true so the UI can offer the Claim button.
    // Mutating evaluation endpoints still require explicit assignment.
    const isAssigned = project.assignedEvaluator?.toString() === user.id;
    const isClaimable = !project.assignedEvaluator && project.status === 'submitted';
    if (!isAssigned && !isClaimable) {
      return NextResponse.json({ error: 'This project is not assigned to you' }, { status: 403 });
    }

    const [activities, tasks, milestones, existingEvaluation] = await Promise.all([
      Activity.find({ project: params.id }).populate('user', 'name email image').sort({ createdAt: 1 }),
      Task.find({ project: params.id }).populate('assignedTo', 'name email image').populate('createdBy', 'name email image'),
      Milestone.find({ project: params.id }).populate('createdBy', 'name email image').sort({ order: 1 }),
      Evaluation.findOne({ project: params.id, evaluator: user.id }),
    ]);

    // Active rubric for scoring.
    const rubric = await getOrSeedDefaultRubric();

    // Read-only files (strip nothing — evaluators may READ code but not write).
    const files = project.files || [];

    return NextResponse.json({
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        language: project.language,
        tags: project.tags,
        status: project.status,
        submission: project.submission,
        owner: project.owner,
        members: project.members,
        chatMessages: project.chatMessages,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      files,
      activities,
      tasks,
      milestones,
      evaluation: existingEvaluation
        ? {
            id: existingEvaluation._id,
            status: existingEvaluation.status,
            finalizedAt: existingEvaluation.finalizedAt,
            overallComments: existingEvaluation.overallComments,
            memberScores: existingEvaluation.memberScores,
            aiDraft: existingEvaluation.aiDraft,
          }
        : null,
      rubric: {
        id: rubric._id?.toString() || '',
        name: rubric.name,
        description: rubric.description,
        totalMarks: rubric.totalMarks,
        criteria: rubric.criteria,
      },
      readOnly: true,
      claimable: isClaimable,
      evaluationMode: project.status !== 'draft',
    });
  } catch (error) {
    console.error('Evaluator project detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}