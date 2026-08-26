'use client';

import { SessionProvider } from 'next-auth/react';
import { SmoothCursor } from '@/components/ui/smooth-cursor';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SmoothCursor />
      {children}
    </SessionProvider>
  );
}