import Link from 'next/link';

/**
 * CodeSynce brand logo — hexagonal "CS" monogram with teal→blue gradient.
 */
export function LogoMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cs-logo-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.5" stopColor="#0ea5a4" />
          <stop offset="1" stopColor="#3b5bdb" />
        </linearGradient>
      </defs>
      {/* Hexagon shell (open on the right, forming the "C") */}
      <path
        d="M32 3 56 17v26L32 57 8 43V17L32 3Z"
        stroke="url(#cs-logo-grad)"
        strokeWidth="6"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Inner "S" stroke */}
      <path
        d="M42 24c0-3.5-4.5-6-10-6s-10 2.5-10 6 4 5.5 10 6.5 10 3 10 6.5-4.5 6-10 6-10-2.5-10-6"
        stroke="url(#cs-logo-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark className="w-9 h-9" />
      {!compact && (
        <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Code<span className="text-primary-400">Synce</span>
        </span>
      )}
    </Link>
  );
}
