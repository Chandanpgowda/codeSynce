'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AuthComponent from '@/components/ui/sign-up';

export default function SignUpPage() {
  const router = useRouter();
  // Kept between the "request OTP" and "verify OTP" steps of the flow.
  const credentialsRef = useRef<{ email: string; password: string } | null>(null);
  const [googleError, setGoogleError] = useState('');

  const handleRequestOtp = async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, type: 'email', mode: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Failed to send the verification code';
      }
      credentialsRef.current = { email, password };
      return null;
    } catch (err) {
      console.error('Send OTP error:', err);
      return 'Failed to send the verification code. Please try again.';
    }
  };

  const handleVerifyOtp = async (code: string): Promise<string | null> => {
    const creds = credentialsRef.current;
    if (!creds) return 'Session expired. Please start again.';
    const name = creds.email.split('@')[0].replace(/[._-]+/g, ' ');

    try {
      // Verify OTP and create the account
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: creds.email,
          code,
          type: 'email',
          name,
          mode: 'signup',
          password: creds.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Invalid or expired code';
      }

      // Create a session with the NextAuth credentials provider
      const result = await signIn('credentials', {
        identifier: creds.email,
        code,
        redirect: false,
      });
      if (result?.error) {
        return 'Account created! Please sign in manually.';
      }
      return null;
    } catch (err) {
      console.error('Verify OTP error:', err);
      return 'Failed to verify the code. Please try again.';
    }
  };

  const handleComplete = () => {
    router.push('/home');
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn('google', { callbackUrl: '/home' });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setGoogleError('Failed to sign in with Google');
    }
  };

  return (
    <>
      <AuthComponent
        brandName="CodeSync"
        onRequestOtp={handleRequestOtp}
        onVerifyOtp={handleVerifyOtp}
        onGoogleSignIn={handleGoogleSignIn}
        onComplete={handleComplete}
      />
      {/* Google errors surface via NextAuth redirects; keep a fallback notice */}
      {googleError ? <div className="sr-only">{googleError}</div> : null}
    </>
  );
}