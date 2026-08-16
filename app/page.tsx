import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-dark-600 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Code<span className="text-primary-500">Sync</span></span>
            </div>
            <div className="flex items-center gap-4">
              {session?.user ? (
                <Link href="/home" className="btn-primary">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" className="text-gray-300 hover:text-white transition-colors">
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="btn-primary">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Floating orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 animate-fade-in-up">
              Code Together.
              <br />
              <span className="gradient-text">
                Build Amazing Things.
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              CodeSync is a real-time collaborative coding platform. Create projects,
              invite developers, code together with VS Code-like editor, chat in real-time,
              and get AI-powered assistance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <Link href="/auth/signup" className="btn-primary btn-glow text-lg px-8 py-3">
                Start Coding Free
              </Link>
              <Link href="/home" className="btn-secondary text-lg px-8 py-3 hover:border-primary-500 hover:bg-dark-600 transition-all duration-300">
                Explore Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Everything You Need to Code Together
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Real-time Collaboration</h3>
              <p className="text-gray-400">
                Multiple developers can code in the same file simultaneously with live cursors and instant sync.
              </p>
            </div>

            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">VS Code-like Editor</h3>
              <p className="text-gray-400">
                Full-featured code editor with syntax highlighting, IntelliSense, multi-file support, and more.
              </p>
            </div>

            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Team Chat</h3>
              <p className="text-gray-400">
                Built-in real-time chat so your team can discuss code, share ideas, and stay in sync.
              </p>
            </div>

            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Assistant</h3>
              <p className="text-gray-400">
                Get instant help with code, debugging, and best practices from our built-in AI assistant.
              </p>
            </div>

            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Secure Access</h3>
              <p className="text-gray-400">
                Project owners approve join requests, ensuring only trusted developers can access your code.
              </p>
            </div>

            <div className="card card-hover">
              <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4 animate-pulse-glow">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Cloud Deployed</h3>
              <p className="text-gray-400">
                Deployed on Vercel with MongoDB Atlas for reliable, scalable, and fast performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20">
        <div className="orb orb-1" style={{ opacity: 0.2 }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl font-bold text-white mb-6 animate-fade-in-up">
            Ready to Start Collaborating?
          </h2>
          <p className="text-gray-400 text-lg mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Join thousands of developers building amazing projects together.
          </p>
          <Link href="/auth/signup" className="btn-primary btn-glow text-lg px-10 py-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-600 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>© {new Date().getFullYear()} CodeSync. Built for developers, by developers.</p>
        </div>
      </footer>
    </main>
  );
}