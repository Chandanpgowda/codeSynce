'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, ArrowLeft, Eye, Users, Activity, BarChart3, ListChecks, ClipboardList,
  Sparkles, FileText, Lock, CheckCircle2, Save, PlayCircle,
} from 'lucide-react';

type TabKey = 'overview' | 'timeline' | 'contribution' | 'tasks' | 'rubric' | 'ai' | 'report';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Eye className="w-4 h-4" /> },
  { key: 'timeline', label: 'Timeline', icon: <Activity className="w-4 h-4" /> },
  { key: 'contribution', label: 'Contribution', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'tasks', label: 'Tasks & Milestones', icon: <ListChecks className="w-4 h-4" /> },
  { key: 'rubric', label: 'Rubric & Scores', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'ai', label: 'AI Assistant', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'report', label: 'Report', icon: <FileText className="w-4 h-4" /> },
];

const ACTIVITY_LABEL: Record<string, string> = {
  project_created: 'Project created', member_joined: 'Member joined', file_created: 'File created',
  file_modified: 'File modified', file_renamed: 'File renamed', file_deleted: 'File deleted',
  task_created: 'Task created', task_updated: 'Task updated', task_assigned: 'Task assigned',
  task_completed: 'Task completed', milestone_created: 'Milestone created',
  milestone_completed: 'Milestone completed', project_submitted: 'Project submitted',
  evaluation_started: 'Evaluation started', evaluation_finalized: 'Evaluation finalized',
  bug_reported: 'Bug reported', bug_resolved: 'Bug resolved', test_executed: 'Test executed',
  documentation_updated: 'Docs updated', ai_used: 'AI used', chat_message: 'Discussion', other: 'Update',
};

export default function EvaluatorProjectPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [scoresDraft, setScoresDraft] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) { router.push('/auth/signin'); return; }
    if (session.user.role && session.user.role !== 'evaluator') { router.push('/home'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`/api/evaluator/projects/${params.id}`);
      if (res.status === 401) { router.push('/auth/signin'); return; }
      const json = await res.json();
      if (res.ok) setData(json); else setLoadError(json.error || 'Failed to load');
    } catch { setLoadError('Failed to load project'); }
    finally { setLoading(false); }
  }, [params.id, router]);

  async function claimProject() {
    setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/evaluator/projects/${params.id}/assign`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) { await load(); setNotice('Project assigned to you for evaluation.'); }
      else setNotice(json.error || 'Failed to claim');
    } catch { setNotice('Failed to claim'); } finally { setBusy(false); }
  }

  async function createEvaluation() {
    setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/projects/${params.id}/evaluation`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) { await load(); setNotice('Evaluation draft created.'); }
      else setNotice(json.error || 'Failed to create evaluation');
    } catch { setNotice('Failed to create evaluation'); } finally { setBusy(false); }
  }

  // Save the currently edited scores (draft, human-entered).
  async function saveScores(memberScores: any[], overallComments: string, evalId: string) {
    setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/projects/${params.id}/evaluation/${evalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberScores, overallComments }),
      });
      const json = await res.json();
      if (res.ok) { await load(); setNotice('Scores saved (draft).'); }
      else setNotice(json.error || 'Failed to save');
    } catch { setNotice('Failed to save'); } finally { setBusy(false); }
  }

  async function requestAI() {
    setBusy(true); setNotice('');
    try {
      const res = await fetch('/api/evaluator/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id }),
      });
      const json = await res.json();
      if (res.ok) { setAiSuggestion(json); setTab('ai'); }
      else setNotice(json.error || 'AI failed');
    } catch { setNotice('AI request failed'); } finally { setBusy(false); }
  }

  async function acceptAIScores() {
    if (!data?.evaluation?.id || !aiSuggestion) return;
    const memberScores = (data.evaluation.memberScores || []).map((m: any) => ({
      userId: m.user._id || m.user,
      scores: { ...aiSuggestion.suggestedScores },
      comments: m.comments,
    }));
    await saveScores(memberScores, data.evaluation.overallComments, data.evaluation.id);
  }

  async function finalize(evalId: string) {
    if (!window.confirm('Finalize this evaluation? Final marks cannot be changed afterward.')) return;
    setBusy(true); setNotice('');
    try {
      const res = await fetch(`/api/projects/${params.id}/evaluation/${evalId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'finalize' }),
      });
      const json = await res.json();
      if (res.ok) { await load(); setNotice('Evaluation finalized. Project marked as EVALUATED.'); }
      else setNotice(json.error || 'Failed to finalize');
    } catch { setNotice('Failed to finalize'); } finally { setBusy(false); }
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">Loading evaluation workspace…</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex flex-col items-center justify-center gap-3">
        <Lock className="w-8 h-8 text-red-400" />
        <p>{loadError}</p>
        <Link href="/evaluator" className="text-sky-400 text-sm">← Back to Evaluator Dashboard</Link>
      </div>
    );
  }

  // Unclaimed submitted project: offer to claim before opening the workspace.
  if (data?.claimable) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">READY FOR EVALUATION</span>
        <h1 className="text-2xl font-bold">{data.project?.name || 'Project'}</h1>
        <p className="text-gray-400 text-sm max-w-md">This project has been submitted by the team but is not yet assigned to an evaluator. Claim it to start your evaluation.</p>
        {notice && <p className="text-sky-400 text-sm">{notice}</p>}
        <div className="flex items-center gap-3 mt-2">
          <button onClick={claimProject} disabled={busy} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors">Claim &amp; Start Evaluation</button>
          <Link href="/evaluator" className="text-sky-400 text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const project = data?.project;
  const evalId = data?.evaluation?.id;
  const evaluation = data?.evaluation;
  const isLocked = evaluation?.status === 'finalized';

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1117]/85 backdrop-blur-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/evaluator" className="text-white/50 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                <h1 className="font-semibold truncate">{project?.name}</h1>
              </div>
              <p className="text-xs text-gray-500 truncate">Evaluator workspace · {project?.status?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {data?.readOnly && (
              <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> EVALUATION MODE — READ ONLY
              </span>
            )}
            {isLocked && (
              <span className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> FINALIZED
              </span>
            )}
          </div>
        </div>
        {/* Tab nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 overflow-x-auto">
          <nav className="flex gap-1 text-sm">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${tab === t.key ? 'bg-sky-500/15 text-sky-300' : 'text-gray-400 hover:text-white'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {notice && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-200 text-sm">{notice}</div>
        )}

        {tab === 'overview' && <OverviewTab project={project} />}
        {tab === 'timeline' && <TimelineTab activities={data?.activities || []} />}
        {tab === 'contribution' && <ContributionPanel projectId={params.id} />}
        {tab === 'tasks' && <TasksMilestonesTab tasks={data?.tasks || []} milestones={data?.milestones || []} />}
        {tab === 'rubric' && (
          <RubricTab
            rubric={data?.rubric}
            evaluation={evaluation}
            memberScores={data?.evaluation?.memberScores}
            scoresDraft={scoresDraft}
            setScoresDraft={setScoresDraft}
            isLocked={isLocked}
            onSave={saveScores}
            onFinalize={finalize}
            onCreate={createEvaluation}
            evalId={evaluation?.id}
          />
        )}
        {tab === 'ai' && (
          <AITab
            aiSuggestion={aiSuggestion}
            requestAI={requestAI}
            acceptAIScores={acceptAIScores}
            busy={busy}
            rubric={data?.rubric}
            evaluation={evaluation}
          />
        )}
        {tab === 'report' && <ReportTab data={data} />}
      </main>
    </div>
  );
}

/* ---------- Tab: Overview ---------- */
function OverviewTab({ project }: { project: any }) {
  if (!project) return <EmptyPanel />;
  const team = [project.owner, ...(project.members || [])].filter(Boolean);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <h2 className="font-semibold mb-2">Project Overview</h2>
        <p className="text-gray-400 text-sm mb-4">{project.description || 'No description.'}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Status" value={<span className="text-sky-300 capitalize">{project.status?.replace(/_/g, ' ')}</span>} />
          <Field label="Language" value={project.language} />
          <Field label="Created" value={new Date(project.createdAt).toLocaleDateString()} />
          <Field label="Tags" value={(project.tags || []).join(', ') || '—'} />
        </div>
      </div>
      <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-sky-400" /> Team ({team.length})</h2>
        <div className="space-y-2 mt-2">
          {team.map((m: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-xs font-bold uppercase">
                {m.name?.[0]}
              </div>
              <div>
                <p className="font-medium">{m.name}{m._id === project.owner?._id && <span className="text-xs text-amber-300 ml-2">Owner</span>}</p>
                <p className="text-xs text-gray-500">{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {project.submission && (
        <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5 md:col-span-2">
          <h2 className="font-semibold mb-2">Submission Snapshot</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="Submitted" value={new Date(project.submission.submittedAt).toLocaleString()} />
            <Field label="Files" value={String(project.submission.fileCount ?? '—')} />
            <Field label="Team Snapshot" value={`${project.submission.teamSnapshot?.length || 0} members`} />
            <Field label="Events" value={String(Object.values(project.submission.activitySummary || {}).reduce((a: any, b: any) => a + b, 0))} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-white/5 rounded-lg p-2 bg-white/[0.02]">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function EmptyPanel() {
  return <div className="text-gray-400 text-sm border border-dashed border-white/10 rounded-xl py-16 text-center">No data available.</div>;
}

/* ---------- Tab: Timeline (Evidence) ---------- */
function TimelineTab({ activities }: { activities: any[] }) {
  const [selected, setSelected] = useState<any | null>(null);
  if (!activities.length) return <EmptyPanel />;
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-px">
        {activities.map((a) => (
          <button key={a._id} onClick={() => setSelected(a)}
            className={`w-full text-left border border-white/5 bg-[#0d1117] rounded-lg p-3 hover:border-sky-500/40 transition-colors ${selected?._id === a._id ? 'border-sky-500/60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/80 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" /> {ACTIVITY_LABEL[a.activityType] || a.activityType}
              </span>
              <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{a.message}</p>
            <p className="text-xs text-gray-600 mt-1">{a.user?.name} {a.file && `· ${a.file}`}</p>
          </button>
        ))}
      </div>
      <aside className="border border-white/10 bg-[#0d1117] rounded-xl p-4 h-fit sticky top-40">
        {selected ? (
          <div>
            <h3 className="font-semibold text-sm mb-2">Event Evidence</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500 text-xs">Who</dt><dd>{selected.user?.name}</dd></div>
              <div><dt className="text-gray-500 text-xs">When</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
              <div><dt className="text-gray-500 text-xs">Action</dt><dd>{ACTIVITY_LABEL[selected.activityType] || selected.activityType}</dd></div>
              {selected.file && <div><dt className="text-gray-500 text-xs">File</dt><dd>{selected.file}</dd></div>}
            </dl>
            <p className="text-gray-400 text-xs mt-3 border-t border-white/5 pt-3">{selected.message}</p>
          </div>
        ) : <p className="text-gray-500 text-sm">Select an event to inspect its evidence — who, when, what, and which file.</p>}
      </aside>
    </div>
  );
}

/* ---------- Tab: Tasks & Milestones ---------- */
function TasksMilestonesTab({ tasks, milestones }: { tasks: any[]; milestones: any[] }) {
  const statusColor = (s: string) => ({
    todo: 'text-gray-400', in_progress: 'text-sky-300', review: 'text-amber-300', completed: 'text-emerald-300',
    pending: 'text-gray-400', active: 'text-sky-300',
  }[s] || 'text-gray-400');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <h2 className="font-semibold mb-3">Tasks ({tasks.length})</h2>
        {tasks.length === 0 && <p className="text-gray-500 text-sm">No tasks recorded.</p>}
        <div className="space-y-2">
          {tasks.map((t: any) => (
            <div key={t._id} className="border border-white/5 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.title}</span>
                <span className={`text-xs capitalize ${statusColor(t.status)}`}>{t.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.description || '—'}</p>
              <p className="text-xs text-gray-600 mt-1">
                {t.assignedTo?.name && <>Assigned: {t.assignedTo.name} · </>}
                Priority: {t.priority} · Created by {t.createdBy?.name}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <h2 className="font-semibold mb-3">Milestones ({milestones.length})</h2>
        {milestones.length === 0 && <p className="text-gray-500 text-sm">No milestones recorded.</p>}
        <div className="space-y-2">
          {milestones.map((m: any) => (
            <div key={m._id} className="border border-white/5 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.name}</span>
                <span className={`text-xs capitalize ${statusColor(m.status)}`}>{m.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{m.description || '—'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- Tab: Contribution Analytics ---------- */
function ContributionPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/projects/${projectId}/contributions`)
      .then((r) => r.json())
      .then((d) => (d.members ? setData(d) : setError(d.error || 'Failed')))
      .catch(() => setError('Failed to load contributions'));
  }, [projectId]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading contribution evidence…</p>;

  return (
    <div className="space-y-6">
      <div className="border border-white/10 bg-[#0d1117] rounded-xl p-4 text-xs text-gray-400">
        Contribution analytics are <strong className="text-white/80">evidence signals</strong> derived from recorded development activity —
        they help evaluate <em>how</em> a project was built, not a perfect measure of skill or effort.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.members?.map((m: any) => (
          <div key={m.user._id} className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold uppercase">{m.user.name?.[0]}</div>
              <div>
                <h3 className="font-semibold">{m.user.name}</h3>
                <p className="text-xs text-gray-500">{m.totalEvents} events · {m.filesTouched} files</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Signal label="Tasks created" value={String(m.tasksCreated)} />
              <Signal label="Tasks completed" value={String(m.tasksCompleted)} />
              <Signal label="Files touched" value={String(m.filesTouched)} />
              <Signal label="Total events" value={String(m.totalEvents)} />
            </div>
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Activity breakdown</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(m.activities || {}).map(([k, v]) => (
                  <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    {ACTIVITY_LABEL[k] || k}: {String(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {(!data.members || data.members.length === 0) && (
          <p className="text-gray-500 text-sm col-span-2">No contribution evidence recorded yet.</p>
        )}
        <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5 col-span-2">
          <h3 className="font-semibold text-sm mb-2">Team Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Signal label="Total events" value={String(data.team?.totalEvents ?? 0)} />
            <Signal label="Files touched" value={String(data.team?.filesTouched ?? 0)} />
            <Signal label="Tasks" value={`${data.team?.tasksCompleted ?? 0}/${data.team?.tasksTotal ?? 0} done`} />
            <Signal label="Milestones" value={`${data.team?.milestonesCompleted ?? 0}/${data.team?.milestonesTotal ?? 0} done`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/5 rounded-lg p-2 bg-white/[0.02]">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

/* ---------- Tab: Rubric & Scores ---------- */
type RubricTabProps = {
  rubric: any;
  evaluation: any;
  memberScores: any[];
  scoresDraft: Record<string, Record<string, number>>;
  setScoresDraft: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  isLocked: boolean;
  onSave: (memberScores: any[], overallComments: string, evalId: string) => void;
  onFinalize: (evalId: string) => void;
  onCreate: () => void;
  evalId?: string;
};

function RubricTab(props: RubricTabProps) {
  const { rubric, evaluation, memberScores, scoresDraft, setScoresDraft, isLocked, onSave, onFinalize, onCreate, evalId } = props;
  const [comments, setComments] = useState(evaluation?.overallComments || '');

  if (!rubric) return <EmptyPanel />;
  if (!evaluation) {
    return (
      <div className="border border-dashed border-white/10 rounded-xl p-12 text-center">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-600" />
        <p className="text-gray-400">No evaluation started yet.</p>
        <p className="text-xs text-gray-600 mt-1">Create an evaluation draft to begin scoring individual members.</p>
        <button onClick={onCreate} className="mt-4 px-4 py-2 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-500/40 hover:bg-sky-500/30 transition text-sm">
          Create Evaluation Draft
        </button>
      </div>
    );
  }

  const updateScore = (userId: string, key: string, val: number, max: number) => {
    setScoresDraft((prev) => {
      const member = { ...(prev[userId] || {}) };
      member[key] = Math.min(Math.max(0, Number(val) || 0), max);
      return { ...prev, [userId]: member };
    });
  };

  return (
    <div className="space-y-6">
      {isLocked && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm">
          This evaluation is <strong>finalized</strong>. Scores and comments are locked.
        </div>
      )}
      <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Evaluation Rubric — {rubric.name}</h2>
          <span className="text-sm text-gray-400">Total: {rubric.totalMarks} marks</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {rubric.criteria?.map((c: any) => (
            <div key={c.key} className="border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{c.label}</span>
                <span className="text-xs text-gray-500">max {c.maxMarks}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{c.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold px-1">Individual Member Scores</h2>
        {(memberScores || []).map((m: any) => {
          const uid = m.user?._id || m.user;
          const draft = scoresDraft[uid] || {};
          const persisted = Object.values(m.scores || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
          const myTotal = Object.keys(draft).length ? Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0) : persisted;
          return (
            <div key={uid} className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{m.user?.name || 'Member'}</span>
                <span className="text-sm text-emerald-300">Total: {myTotal}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {rubric.criteria?.map((c: any) => {
                  const current = draft[c.key] ?? m.scores?.[c.key] ?? 0;
                  return (
                    <label key={c.key} className="flex items-center justify-between border border-white/5 rounded-lg p-2">
                      <span className="text-xs text-gray-400">{c.label}</span>
                      <input
                        type="number"
                        min={0}
                        max={c.maxMarks}
                        value={isLocked ? m.scores?.[c.key] ?? 0 : current}
                        disabled={isLocked}
                        onChange={(e) => updateScore(uid, c.key, Number(e.target.value), c.maxMarks)}
                        className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-right focus:outline-none"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
          <label className="block text-sm text-gray-400 mb-2">Overall Evaluator Comments</label>
          <textarea
            value={isLocked ? evaluation.overallComments : comments}
            disabled={isLocked}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-sky-500/50"
            placeholder="Summary of the evaluation…"
          />
        </div>
      </div>

      {!isLocked && (
        <div className="flex gap-3">
          <button onClick={() => onSave((memberScores || []).map((m: any) => ({ userId: m.user?._id || m.user, scores: scoresDraft[m.user?._id || m.user] || {}, comments: '' })), comments, evalId!)}
            className="px-4 py-2 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-500/40 hover:bg-sky-500/30 transition text-sm flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={() => onFinalize(evalId!)}
            className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/30 transition text-sm">
            Finalize Evaluation
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Tab: AI Evaluation Assistant ---------- */
type AITabProps = {
  aiSuggestion: any;
  requestAI: () => void;
  acceptAIScores: () => void;
  busy: boolean;
  rubric: any;
  evaluation: any;
};

function AITab(props: AITabProps) {
  const { aiSuggestion, requestAI, acceptAIScores, busy, rubric, evaluation } = props;
  return (
    <div className="space-y-6">
      <div className="border border-white/10 bg-[#0d1117] rounded-xl p-5">
        <h2 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> AI Evaluation Assistant</h2>
        <p className="text-sm text-gray-400 mt-2">
          The AI analyzes project evidence and proposes <strong>suggested scores</strong>. It never assigns official marks —
          you review, adjust, and make the final decision.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={requestAI} disabled={busy}
            className="px-4 py-2 bg-violet-500/20 text-violet-200 rounded-lg border border-violet-500/40 hover:bg-violet-500/30 transition text-sm flex items-center gap-1.5 disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {busy ? 'Analyzing evidence…' : 'Generate AI Suggested Scores'}
          </button>
          {aiSuggestion && (
            <button onClick={acceptAIScores} disabled={!evaluation?.id}
              className="px-4 py-2 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-500/40 hover:bg-sky-500/30 transition text-sm disabled:opacity-50">
              Accept Suggestions → Rubric
            </button>
          )}
        </div>
      </div>

      {aiSuggestion && (
        <div className="border border-violet-500/20 bg-[#0d1117] rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-violet-300 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> AI-GENERATED · ADVISORY ONLY · VERIFY BEFORE ACCEPTING
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {rubric?.criteria?.map((c: any) => (
              <div key={c.key} className="flex items-center justify-between border border-white/5 rounded-lg p-2">
                <span className="text-sm text-gray-400">{c.label}</span>
                <span className="text-sm text-violet-200">{aiSuggestion.suggestedScores?.[c.key] ?? '—'} / {c.maxMarks}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/5 pt-3">
            <p className="text-xs text-gray-500 mb-1">AI Reasoning</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiSuggestion.reasoning || 'No reasoning returned.'}</p>
          </div>
        </div>
      )}

      {!aiSuggestion && (
        <div className="border border-dashed border-white/10 rounded-xl p-10 text-center text-gray-500 text-sm">
          Run the assistant to see an evidence-based suggested score and reasoning.
        </div>
      )}
    </div>
  );
}

/* ---------- Tab: Report ---------- */
function ReportTab({ data }: { data: any }) {
  const { project, evaluation, rubric } = data || {};
  const memberScores = evaluation?.memberScores || [];

  if (!project) return <EmptyPanel />;

  return (
    <div className="border border-white/10 bg-[#0d1117] rounded-xl p-6 max-w-3xl">
      <h2 className="text-xl font-bold mb-4">Evaluation Report</h2>

      <h3 className="text-sm font-semibold text-sky-400 mt-4 mb-1">PROJECT INFORMATION</h3>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <Field label="Project" value={project.name} />
        <Field label="Status" value={project.status?.replace(/_/g, ' ')} />
        <Field label="Submitted" value={project.submission ? new Date(project.submission.submittedAt).toLocaleDateString() : '—'} />
        <Field label="Evaluated" value={evaluation?.finalizedAt ? new Date(evaluation.finalizedAt).toLocaleDateString() : 'Not finalized'} />
      </div>

      <h3 className="text-sm font-semibold text-sky-400 mt-4 mb-1">TEAM</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {[project.owner, ...(project.members || [])].filter(Boolean).map((m: any, i: number) => (
          <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10">{m?.name}</span>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-sky-400 mt-4 mb-1">EVALUATION</h3>
      {evaluation ? (
        <div className="space-y-2">
          {(rubric?.criteria || []).map((c: any) => {
            const totalAwarded = memberScores.reduce((sum: number, ms: any) => sum + (Number(ms.scores?.[c.key]) || 0), 0);
            return (
              <div key={c.key} className="flex items-center justify-between border border-white/5 rounded-lg p-2 text-sm">
                <span className="text-gray-300">{c.label}</span>
                <span><span className="text-emerald-300">{totalAwarded}</span> <span className="text-gray-500">/ {c.maxMarks} × {memberScores.length || 1} members</span></span>
              </div>
            );
          })}
          {evaluation.overallComments && (
            <div className="border-t border-white/5 pt-3 mt-2">
              <p className="text-xs text-gray-500 mb-1">Final Comments</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{evaluation.overallComments}</p>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-3">
            Evaluation status: <strong className={evaluation.status === 'finalized' ? 'text-emerald-300' : 'text-amber-300'}>{evaluation.status.toUpperCase()}</strong>
          </p>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No evaluation yet.</p>
      )}

      <h3 className="text-sm font-semibold text-sky-400 mt-5 mb-1">INDIVIDUAL SCORES</h3>
      {memberScores.length ? (
        <div className="space-y-2">
          {memberScores.map((ms: any, i: number) => {
            const total = Object.values(ms.scores || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
            return (
              <div key={i} className="border border-white/5 rounded-lg p-3 text-sm flex justify-between">
                <span className="font-medium">{ms.user?.name || `Member ${i + 1}`}</span>
                <span className="text-emerald-300">{total}</span>
              </div>
            );
          })}
        </div>
      ) : <p className="text-gray-500 text-sm">No individual scores yet.</p>}

      <p className="text-xs text-gray-600 mt-6 border-t border-white/5 pt-3">
        Generated by CodeSynce Evaluation Intelligence. AI assists analysis; the evaluator makes the final decision.
      </p>
    </div>
  );
}
