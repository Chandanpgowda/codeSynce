'use client';

import React from 'react';
import Link from 'next/link';
import AntigravityEffect from '@/components/AntigravityEffect';

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'gradient';
  size?: 'default' | 'sm' | 'lg';
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className = '', children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      default: 'bg-white text-black hover:bg-gray-100',
      secondary: 'bg-gray-800 text-white hover:bg-gray-700',
      ghost: 'hover:bg-gray-800/50 text-white',
      gradient:
        'bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95',
    };

    const sizes = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-10 px-5 text-sm',
      lg: 'h-12 px-8 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icons
const ArrowRight = ({ className = '', size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Menu = ({ className = '', size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const X = ({ className = '', size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CodeLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-lg flex items-center justify-center"
    style={{ width: size, height: size, background: '#2563eb' }}
  >
    <svg
      style={{ width: size * 0.62, height: size * 0.62 }}
      fill="none"
      stroke="white"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  </div>
);

export interface SaasTemplateProps {
  /** When true the nav shows a "Dashboard" button instead of Sign in/Sign up. */
  isAuthenticated?: boolean;
  brandName?: string;
}

// Navigation Component
const Navigation = React.memo(({ isAuthenticated = false, brandName = 'CodeSync' }: SaasTemplateProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <CodeLogo />
            <span className="text-xl font-semibold text-white">{brandName}</span>
          </Link>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
            <a href="#getting-started" className="text-sm text-white/60 hover:text-white transition-colors">
              Getting started
            </a>
            <a
              href="https://github.com/Chandanpgowda/codeSynce"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Documentation
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/home">
                <Button type="button" variant="gradient" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button type="button" variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button type="button" variant="default" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-gray-800/50 saas-mobile-menu">
          <div className="px-6 py-4 flex flex-col gap-4">
            <a
              href="#features"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#getting-started"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Getting started
            </a>
            <a
              href="https://github.com/Chandanpgowda/codeSynce"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Documentation
            </a>
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-800/50">
              {isAuthenticated ? (
                <Link href="/home" onClick={() => setMobileMenuOpen(false)}>
                  <Button type="button" variant="gradient" size="sm" className="w-full">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button type="button" variant="ghost" size="sm" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button type="button" variant="default" size="sm" className="w-full">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = 'Navigation';

// Hero Component
const Hero = React.memo(({ isAuthenticated = false }: SaasTemplateProps) => {
  return (
    <section
      id="getting-started"
      className="saas-hero relative min-h-screen flex flex-col items-center justify-start px-6 pt-32 pb-20 md:pt-36 md:pb-24 overflow-hidden"
    >
      {/* Antigravity particle effect background */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 flex justify-center pointer-events-none z-0"
        style={{ opacity: 0.55 }}
      >
        <AntigravityEffect />
      </div>
      <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-700 bg-gray-800/50 backdrop-blur-sm max-w-full">
        <span className="text-xs text-center whitespace-nowrap" style={{ color: '#9ca3af' }}>
          New version is out — realtime collaboration & AI assistant!
        </span>
        <a
          href="#features"
          className="flex items-center gap-1 text-xs hover:text-white transition-all active:scale-95 whitespace-nowrap"
          style={{ color: '#9ca3af' }}
          aria-label="Read more about the new version"
        >
          Read more
          <ArrowRight size={12} />
        </a>
      </aside>

      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-medium text-center max-w-3xl px-6 leading-tight mb-6"
        style={{
          background: 'linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.05em',
        }}
      >
        Give your code <br />
        the collaboration it deserves
      </h1>

      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10" style={{ color: '#9ca3af' }}>
        Real-time collaborative coding with a VS Code-style editor, live team chat and an AI
        assistant — built with Next.js, Tailwind and MongoDB.
      </p>

      <div className="flex items-center gap-4 relative z-10 mb-16">
        {isAuthenticated ? (
          <Link href="/home">
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="rounded-lg flex items-center justify-center"
              aria-label="Open your dashboard"
            >
              Open Dashboard
            </Button>
          </Link>
        ) : (
          <Link href="/auth/signup">
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="rounded-lg flex items-center justify-center"
              aria-label="Get started for free"
            >
              Get started free
            </Button>
          </Link>
        )}
      </div>

      <div className="w-full max-w-5xl relative pb-20">
        {/* Glow behind the preview (CSS instead of external image) */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 w-[90%] h-[420px] pointer-events-none z-0"
          style={{
            top: '-23%',
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(ellipse at center, rgba(99,102,241,0.35), rgba(34,211,238,0.15) 45%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative z-10 rounded-lg overflow-hidden shadow-2xl border border-gray-800/60">
          <img
            src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1600&auto=format&fit=crop"
            alt="Collaborative code editor preview showing colorful source code on screen"
            className="w-full h-auto block"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';

// Main Component
export default function SaasTemplate(props: SaasTemplateProps) {
  return (
    <>
      <Navigation {...props} />
      <Hero {...props} />
    </>
  );
}