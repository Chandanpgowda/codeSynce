'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SignInCard2 from '@/components/ui/sign-in-card-2';

async function getRole(): Promise<'builder' | 'evaluator' | 'guest'> {
  try {
    const res = await fetch('/api/auth/session');
    const session = await res.json();
    if (session?.user?.role) return session.user.role;
    return 'guest';
  } catch {
    return 'guest';
  }
}

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleEmailSignIn = async (identifier: string, password: string): Promise<string | null> => {
    if (!identifier || !password) {
      return 'Please enter your email and password';
    }

    try {
      const result = await signIn('credentials', {
        identifier,
        password,
        redirect: false,
      });

      if (result?.error) {
        return 'Invalid email or password';
      }

      // Route by the SERVER-ASSIGNED role (never by client state).
      const role = await getRole();
      if (role === 'evaluator') {
        router.push('/evaluator');
      } else {
        router.push('/home');
      }
      return null;
    } catch (err) {
      console.error('Sign in error:', err);
      return 'Failed to sign in';
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn('google', { callbackUrl: '/home' });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Failed to sign in with Google');
    }
  };

  return <SignInCard2 onEmailSignIn={handleEmailSignIn} onGoogleSignIn={handleGoogleSignIn} error={error} />;
}