'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import GhostFibers from '@/components/GhostFibers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Activity, BarChart3, Users, Code2, ShieldCheck, ArrowRight } from 'lucide-react';
import { Editor } from '@monaco-editor/react';

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;

  return (
    <div className="vscode-root">
      <div className="vscode-app-container">
        {/* Activity Bar - fixed 48px on the left */}
        <div className="vscode-activity-bar">
          <div className="vscode-activity-menu">
            {/* Activity bar items would go here */}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col min-w-0">
          {/* Editor Area */}
          <div className="vscode-editor-area">
            {/* Monaco Editor Wrapper with vs-code-dark theme */}
            <div className="vscode-monaco-wrap">
              <Editor
                theme="vs-code-dark"
                width="100%"
                height="100%"
                onMount={(editor, monaco) => {
                  monaco.editor.setTheme('vs-code-dark');
                }}
                options={{
                  fontSize: 14,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                  automaticLayout: true,
                  minimap: { enabled: true },
                  cursorBlinking: 'blink',
                  cursorWidth: 1,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  scrollbar: {
                    alwaysConsumeMouseWheel: true
                  }
                }}
              />
            </div>
          </div>

          {/* Terminal Panel - 250px height at bottom */}
          <div className="vscode-terminal-panel">
            {/* Terminal content will be rendered by Terminal component */}
          </div>
        </div>

        {/* Status Bar - 22px at bottom */}
        <div className="vscode-status-bar">
          <div className="vscode-status-item">WSL: Ubuntu</div>
          <div className="vscode-status-item">bash</div>
          <div className="vscode-status-item">CodeSynce</div>
        </div>
      </div>
    </div>
  );
}