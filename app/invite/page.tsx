'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [message, setMessage] = useState('Validating secure invite...');

  useEffect(() => {
    const projectId = searchParams.get('project');
    const token = searchParams.get('token');
    if (status === 'unauthenticated') {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite?project=${projectId || ''}&token=${token || ''}`)}`);
      return;
    }
    if (status !== 'authenticated' || !projectId || !token) return;
    fetch(`/api/projects/${projectId}/invite`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => ok ? router.replace(`/editor/${data.projectId}`) : setMessage(data.error || 'Unable to accept this invite.'))
      .catch(() => setMessage('Unable to accept this invite.'));
  }, [router, searchParams, status]);

  return <main className="min-h-screen flex items-center justify-center p-6"><p className="text-sm text-gray-300">{message}</p></main>;
}

export default function InvitePage() {
  return <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-6"><p className="text-sm text-gray-300">Loading invite...</p></main>}><InviteContent /></Suspense>;
}
