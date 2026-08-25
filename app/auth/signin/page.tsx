'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SignInCard2 from '@/components/ui/sign-in-card-2';

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

      router.push('/home');
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