'use client';
import { LogoMark } from '@/components/Logo';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, LogOut, LayoutDashboard, FolderOpen, Clock, CheckCircle2, Search } from 'lucide-react';

type ProjectStatus = 'submitted' | 'under_evaluation' | 'evaluated';

interface EvalProject {
  _id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  teamSize: number;
  submission: { submittedAt: string } | null;
  owner: { name: string };
  evaluation: { status: string; totalScore: number | null } | null;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  submitted: 'Ready for Evaluation',
  under_evaluation: 'Under Evaluation',
  evaluated: 'Evaluated',
};

const STATUS_COLOR: Record<ProjectStatus, string> = {
  submitted: 'text-amber-300 border-amber-500/40',
  under_evaluation: 'text-sky-300 border-sky-500/40',
  evaluated: 'text-emerald-300 border-emerald-500/40',
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`border bg-[#0d1117] rounded-xl p-4 flex items-center gap-3 ${color.split(' ')[1]}`}>
      <span className="p-2 rounded-lg bg-white/5 text-current">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function EvaluatorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<EvalProject[]>([]);
  const [summary, setSummary] = useState<{ ready: number; underEvaluation: number; evaluated: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }
    if (session.user.role && session.user.role !== 'evaluator') {
      router.push('/home');
      return;
    }
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id]);

  async function fetchProjects() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/evaluator/projects');
      if (res.status === 403 || res.status === 401) {
        router.push('/home');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects);
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to load');
      }
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  const filtered = search
    ? projects.filter((p) =>
        [p.name, p.description].join(' ').toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      <header className="border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <LogoMark className="w-7 h-7" />
            <span>CodeSynce · Evaluator</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/60">{session?.user?.name}</span>
            <Link href="/" className="text-white/50 hover:text-white transition">Home</Link>
            <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="flex items-center gap-1 text-white/50 hover:text-white transition">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-sky-400" /> Evaluator Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">Review assigned projects, inspect evidence, and evaluate fairly.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="bg-[#0d1117] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-sky-500/50 w-64" />
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <StatCard icon={<FolderOpen className="w-4 h-4" />} label="Ready" value={summary.ready} color="border-amber-500/30 text-amber-300" />
            <StatCard icon={<Clock className="w-4 h-4" />} label="Under Evaluation" value={summary.underEvaluation} color="border-sky-500/30 text-sky-300" />
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Evaluated" value={summary.evaluated} color="border-emerald-500/30 text-emerald-300" />
          </div>
        )}

        {error && <p className="mt-6 text-red-400 text-sm">{error}</p>}

        {loading ? (
          <div className="mt-8 text-gray-400">Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 text-center text-gray-400 border border-dashed border-white/10 rounded-xl py-16">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p>{search ? 'No projects match your search.' : 'No assigned projects yet.'}</p>
          </div>
        ) : (
          <div className="grid gap-4 mt-8 md:grid-cols-2">
            {filtered.map((p) => (
              <Link key={p._id} href={`/evaluator/projects/${p._id}`} className="block border border-white/10 bg-[#0d1117] rounded-xl p-5 hover:border-sky-500/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{p.description}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                  <span>Team: {p.teamSize}</span>
                  <span>Owner: {p.owner?.name}</span>
                  {p.submission?.submittedAt && <span>Submitted: {new Date(p.submission.submittedAt).toLocaleDateString()}</span>}
                  {p.evaluation?.totalScore != null && <span className="text-emerald-300">Score: {p.evaluation.totalScore}</span>}
                </div>
                <span className="inline-block mt-3 text-sky-400 text-sm">Open evaluation workspace →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}