import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import GhostFibers from '@/components/GhostFibers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Activity, BarChart3, Users, Code2, ShieldCheck, ArrowRight } from 'lucide-react';

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;

  return (
    <main className="min-h-screen bg-[#060a13] text-white overflow-hidden">
      {/* Subtle grid background */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-8 h-8" />
              <span className="text-lg font-bold">Code<span className="text-primary-400">Synce</span></span>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link href={session?.user?.role === 'evaluator' ? '/evaluator' : '/home'} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">Go to Dashboard <ArrowRight className="w-4 h-4" /></Link>
              ) : (
                <>
                  <Link href="/auth/signin" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2">Sign In</Link>
                  <Link href="/auth/signup" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">Start Building <ArrowRight className="w-4 h-4" /></Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 text-center">
        {/* GhostFibers animated background */}
        <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden pointer-events-none">
          <GhostFibers
            lineColor="#140E35"
            glowColor="#3437A0"
            speed={0.2}
            scale={2}
            rotation={0}
            rotationSpeed={0.25}
            layers={4}
            dpr={1}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060a13]/40 to-[#060a13]" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
          Evidence-Based Project Evaluation
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Build Together. <span className="bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">Track Everything.</span> Evaluate Fairly.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">A collaborative project development and evaluation platform that captures meaningful development activity, provides contribution evidence, and helps evaluators assess projects using structured, AI-assisted evaluation.</p>
        <p className="text-primary-300/80 text-sm max-w-2xl mx-auto mb-10 italic">&ldquo;Don&apos;t evaluate only what students built. Evaluate how they built it.&rdquo;</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 transition-all hover:-translate-y-0.5">Start Building <ArrowRight className="w-5 h-5" /></Link>
          <Link href="/auth/signin?role=evaluator" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all">Evaluator Login</Link>
        </div>
      </section>

      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center"><Activity className="w-5 h-5 text-primary-400" /></div>
              <h3 className="font-semibold text-white">Collaborative Development</h3>
              <p className="text-sm text-gray-500 max-w-xs">Real-time code editor, team chat, AI assistant, and terminal — everything your team needs to build together.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-cyan-400" /></div>
              <h3 className="font-semibold text-white">Activity Evidence</h3>
              <p className="text-sm text-gray-500 max-w-xs">Meaningful development events are captured automatically — not keystrokes, but real progress signals.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-emerald-400" /></div>
              <h3 className="font-semibold text-white">Fair Evaluation</h3>
              <p className="text-sm text-gray-500 max-w-xs">Structured rubrics, contribution analytics, and AI-assisted analysis — the evaluator always makes the final decision.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How CodeSynce Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Build Together', desc: 'Create a project, invite your team, and collaborate in real-time with the editor, chat, and AI assistant.', icon: <Users className="w-5 h-5 text-primary-400" /> },
            { step: '02', title: 'Track Progress', desc: 'Every meaningful action — features, bug fixes, tasks, milestones — is recorded as development evidence.', icon: <Activity className="w-5 h-5 text-cyan-400" /> },
            { step: '03', title: 'Evaluate Fairly', desc: 'Submit for evaluation. Evaluators review evidence, analytics, and use AI assistance to assign structured marks.', icon: <ShieldCheck className="w-5 h-5 text-emerald-400" /> },
          ].map((item) => (
            <div key={item.step} className="relative bg-[#0d1117] border border-white/5 rounded-2xl p-6 hover:border-primary-500/20 transition-colors">
              <span className="text-xs font-mono text-primary-500/60 mb-3 block">{item.step}</span>
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-primary-500/10 to-transparent border border-primary-500/20 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-2">Project Builder</h3>
            <p className="text-sm text-gray-400 mb-5">For students and developers. Create projects, collaborate with your team, manage tasks, and submit for evaluation.</p>
            <ul className="space-y-2 mb-6">
              {['Real-time collaborative editor', 'Team chat & AI assistant', 'Task & milestone management', 'Submit for evaluation'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300"><span className="w-1.5 h-1.5 rounded-full bg-primary-400" />{f}</li>
              ))}
            </ul>
            <Link href="/auth/signup" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">Start Building <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-2">Evaluator</h3>
            <p className="text-sm text-gray-400 mb-5">For teachers and reviewers. Inspect development evidence, analyze contributions, and assign structured marks.</p>
            <ul className="space-y-2 mb-6">
              {['Read-only project inspection', 'Contribution analytics', 'AI evaluation assistant', 'Structured rubric & reports'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{f}</li>
              ))}
            </ul>
            <Link href="/auth/signin?role=evaluator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">Evaluator Login <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Code2 className="w-4 h-4" />
            &copy; {new Date().getFullYear()} CodeSynce. Build Together. Track Everything. Evaluate Fairly.
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <span>Evidence-Based Evaluation</span><span>&bull;</span><span>AI-Assisted, Human-Decided</span>
          </div>
        </div>
      </footer>
    </main>
  );
}