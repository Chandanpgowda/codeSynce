'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
  role?: string;
  requiredRole?: string;
}

export default function AccessDenied({
  message = "You don't have permission to access this page.",
  role,
  requiredRole,
}: AccessDeniedProps) {
  const router = useRouter();

  useEffect(() => {
    // Optional: auto-redirect after 5 seconds if no role matches
    // const t = setTimeout(() => router.push('/home'), 5000);
    // return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#060a13] text-white flex items-center justify-center">
      <div className="max-w-md w-full px-6 py-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-8">{message}</p>

        {role && requiredRole && (
          <p className="text-xs text-gray-500 mb-8">
            Your role: <span className="text-red-400">{role}</span> &nbsp;|&nbsp;
            Required: <span className="text-emerald-400">{requiredRole}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/home"
            className="inline-flex items-center justify-center px-4 py-2 bg-transparent border border-white/10 rounded-lg text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            <LogIn className="w-4 h-4 mr-2" /> Sign In Again
          </Link>
        </div>
      </div>
    </div>
  );
}