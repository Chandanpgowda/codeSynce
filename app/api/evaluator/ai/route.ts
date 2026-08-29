import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Activity from '@/models/Activity';
import Task from '@/models/Task';
import Milestone from '@/models/Milestone';
import { requireEvaluator, isValidObjectId } from '@/lib/auth-guard';
import { getOrSeedDefaultRubric } from '@/lib/activities';
import type { ICriterion } from '@/models/EvaluationCriteria';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Advisory AI evaluation assistance. The AI NEVER finalizes or assigns official
 * marks — it proposes evidence-based suggested scores that the HUMAN evaluator
 * reviews and may accept or modify.
 *
 * Flow: Evidence → AI Analysis → Suggested Score → Human Review → Final Score.
 * EVALUATOR ONLY.
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { user, error } = await requireEvaluator();
    if (error || !user) return NextResponse.json({ error: error.error }, { status: error.status });

    const body = await request.json();
    const { projectId } = body;
    if (!projectId || !isValidObjectId(projectId)) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const [activities, tasks, milestones, rubric] = await Promise.all([
      Activity.find({ project: projectId }).populate('user', 'name email image').sort({ createdAt: -1 }),
      Task.find({ project: projectId }),
      Milestone.find({ project: projectId }),
      getOrSeedDefaultRubric(),
    ]);

    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'AI evaluation assistant is not configured (GOOGLE_API_KEY missing).' },
        { status: 500 }
      );
    }

    const prompt = buildPrompt(activities, tasks, milestones, rubric);
    const aiResponse = await callGemini(prompt);
    if (!aiResponse.ok) {
      return NextResponse.json(
        { error: aiResponse.error },
        { status: aiResponse.status }
      );
    }

    const capped = capScores(aiResponse.parsed, rubric);

    return NextResponse.json({
      aiGenerated: true,
      advisory: true,
      suggestedScores: capped,
      reasoning: String(aiResponse.parsed.reasoning || '').slice(0, 4000),
      criteria: rubric.criteria.map((c: ICriterion) => ({ key: c.key, label: c.label, maxMarks: c.maxMarks })),
    });
  } catch (error: any) {
    console.error('AI eval assistant error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildPrompt(activities: any[], tasks: any[], milestones: any[], rubric: any) {
  const byUser: Record<string, { name: string; counts: Record<string, number>; files: string[] }> = {};
  let totalEvents = 0;
  const fileSet = new Set<string>();
  for (const a of activities) {
    const u = a.user as any;
    const uid = u?._id?.toString();
    const name = u?.name || 'Unknown';
    if (uid) {
      byUser[uid] = byUser[uid] || { name, counts: {}, files: [] };
      byUser[uid].counts[a.activityType] = (byUser[uid].counts[a.activityType] || 0) + 1;
      if (a.file) { byUser[uid].files.push(a.file); fileSet.add(a.file); }
    }
    totalEvents++;
  }
  const userSummary = Object.entries(byUser).map(([, d]) => ({
    user: d.name,
    events: d.counts,
    filesTouched: d.files.length,
  }));

  return `You are an evaluation support AI in an evidence-based project evaluation platform.
You NEVER assign official marks. You propose advisory suggested scores with reasoning, which a human evaluator reviews before deciding.

Rubric (total ${rubric.totalMarks}):
${rubric.criteria.map((c: ICriterion) => `- ${c.label} (max ${c.maxMarks})`).join('\n')}

Evidence:
- Total recorded activities: ${totalEvents}
- Files touched: ${fileSet.size}
- Tasks: ${tasks.length} total, ${tasks.filter((t) => t.status === 'completed').length} completed
- Milestones: ${milestones.length} total, ${milestones.filter((m) => m.status === 'completed').length} completed
- Per-member activity signals: ${JSON.stringify(userSummary)}

Respond ONLY with valid JSON in exactly this shape:
{
  "suggestedScores": { "problem_understanding": 7, "technical_implementation": 14 },
  "reasoning": "A short paragraph explaining the suggested scores based on the evidence."
}
Score each criterion 0..max. Base scores on evidence (features, tasks, milestones, files, testing) not on lines of code. Clearly keep these as suggestions.`;
}

async function callGemini(prompt: string) {
  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: 'You are a strict JSON-only evaluator assistant. Do not overclaim.' }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
      }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false as const, error: (errData as any)?.error?.message || 'AI evaluation request failed.', status: res.status, parsed: {} as any };
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed: any = {};
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { suggested: {}, reasoning: raw.slice(0, 2000) };
    }
    return { ok: true as const, parsed, error: null as null, status: 200 };
  } catch (error: any) {
    return { ok: false as const, error: error?.message || 'AI evaluation failed.', status: 500, parsed: null as any };
  }
}

function capScores(parsed: any, rubric: any) {
  const capped: Record<string, number> = {};
  for (const c of rubric.criteria as ICriterion[]) {
    const v = Number(parsed.suggestedScores?.[c.key]);
    if (Number.isFinite(v)) {
      capped[c.key] = Math.min(Math.max(0, Math.round(v)), c.maxMarks);
    } else {
      capped[c.key] = Math.round(c.maxMarks / 2);
    }
  }
  return capped;
}