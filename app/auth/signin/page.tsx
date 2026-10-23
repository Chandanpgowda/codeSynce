'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import SignInCard2 from '@/components/ui/sign-in-card-2';

export default function SignInPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState('');

  // After a successful sign-in, redirect based on server-assigned role.
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role === 'evaluator') {
        router.push('/evaluator');
      } else {
        router.push('/home');
      }
    }
  }, [status, session, router]);

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

      // The useEffect above will handle the redirect once session updates.
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