import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import Evaluation from '@/models/Evaluation';
import { requireEvaluator } from '@/lib/auth-guard';

/**
 * Evaluator dashboard: projects assigned/available to this evaluator.
 * EVALUATOR ONLY.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('search') || '').toLowerCase();

    // Every evaluator can see ALL submitted/under-evaluation/evaluated projects.
    // Any evaluator may claim an unclaimed submitted project; projects already
    // claimed by another evaluator are visible read-only (assignedToMe=false).
    const projects = await Project.find({
      status: { $in: ['submitted', 'under_evaluation', 'evaluated'] },
    })
      .populate('owner', 'name email image')
      .populate('members', 'name email image')
      .populate('assignedEvaluator', 'name email image')
      .sort({ 'submission.submittedAt': -1 });

    const evaluations = await Evaluation.find({ evaluator: user.id });

    const list = projects.map((p: any) => {
      const evalDoc = evaluations.find((e) => e.project.toString() === p._id.toString());
      return {
        _id: p._id,
        name: p.name,
        description: p.description,
        language: p.language,
        tags: p.tags,
        status: p.status,
        assignedToMe: (() => {
          const ae = p.assignedEvaluator as unknown;
          if (!ae) return false;
          const id = typeof ae === 'object' ? (ae as { _id?: unknown; toString?: () => string })._id?.toString() ?? (ae as { toString: () => string }).toString() : String(ae);
          return id === user.id.toString();
        })(),
        submission: p.submission,
        teamSize: (p.members?.length || 0) + 1,
        owner: p.owner,
        members: p.members,
        evaluation: evalDoc
          ? {
              id: evalDoc._id,
              status: evalDoc.status,
              totalScore: evalDoc.memberScores?.length
                ? evalDoc.memberScores.reduce((s: number, m: any) => s + (m.total || 0), 0)
                : null,
            }
          : null,
      };
    });

    const filtered = q
      ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
      : list;

    return NextResponse.json({
      projects: filtered,
      summary: {
        ready: filtered.filter((p) => p.status === 'submitted').length,
        underEvaluation: filtered.filter((p) => p.status === 'under_evaluation').length,
        evaluated: filtered.filter((p) => p.status === 'evaluated').length,
      },
    });
  } catch (error) {
    console.error('Evaluator projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}