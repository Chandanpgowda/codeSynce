'use client';

import { SmoothCursor } from '@/components/ui/smooth-cursor';

export default function SmoothCursorDemo() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dark-900 text-white text-center px-4">
      <span className="hidden md:block text-2xl">Move your mouse around</span>
      <span className="block md:hidden text-2xl">Tap anywhere to see the cursor</span>
      <p className="text-gray-400 max-w-md text-sm">
        This custom cursor is already mounted globally via the Providers wrapper,
        so it appears on every page of the site — this page is just a focused
        preview of it.
      </p>
      <SmoothCursor />
    </main>
  );
}