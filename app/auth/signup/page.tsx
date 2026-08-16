'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [method, setMethod] = useState<'google' | 'email'>('google');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn('google', { callbackUrl: '/home' });
    } catch (err) {
      setError('Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!identifier) {
      setError('Please enter your email or phone number');
      return;
    }

    if (method !== 'google' && !name) {
      setError('Please enter your name');
      return;
    }

    if (method !== 'google' && !password) {
      setError('Please enter a password');
      return;
    }

    if (method !== 'google' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          type: method,
          mode: 'signup',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }

      setOtpSent(true);
      setSuccess('OTP sent! Check your ' + method + '.');
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the OTP code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify OTP and create user
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          code: otp,
          type: method,
          name,
          mode: 'signup',
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        return;
      }

      // Sign in with NextAuth credentials provider
      const result = await signIn('credentials', {
        identifier,
        code: otp,
        redirect: false,
      });

      if (result?.error) {
        setError('Failed to create session. Please try signing in.');
        return;
      }

      router.push('/home');
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-gray-400 mt-2">Join CodeSync and start collaborating</p>
        </div>

        <div className="card">
          {/* Method Selection */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMethod('google'); setOtpSent(false); setError(''); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                method === 'google'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              Google
            </button>
            <button
              onClick={() => { setMethod('email'); setOtpSent(false); setError(''); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                method === 'email'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              Email
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {method === 'google' ? (
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          ) : (
            <div className="space-y-4">
              {!otpSent ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="input-field"
                    />
                  </div>
                   <div>
                     <label className="block text-sm text-gray-400 mb-2">
                       Email Address
                     </label>
                     <input
                       type="email"
                       value={identifier}
                       onChange={(e) => setIdentifier(e.target.value)}
                       placeholder="you@example.com"
                       className="input-field"
                     />
                   </div>
                   <div>
                     <label className="block text-sm text-gray-400 mb-2">Password</label>
                     <input
                       type="password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       placeholder="At least 6 characters"
                       className="input-field"
                     />
                     <p className="text-[11px] text-gray-500 mt-1">You will use this password to sign in later</p>
                   </div>
                  <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Enter OTP Code
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit code"
                      maxLength={6}
                      className="input-field text-center text-2xl tracking-widest"
                    />
                  </div>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Create Account'}
                  </button>
                  <button
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="w-full text-sm text-primary-500 hover:text-primary-400"
                  >
                    Change {method}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-primary-500 hover:text-primary-400">
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}