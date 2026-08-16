'use client';

import { useEffect, useRef, useState } from 'react';

interface TerminalProps {
  projectId: string;
  language: string;
  code?: string;
  fileName?: string;
  fileLanguage?: string;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  text: string;
}

type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

// Map file extensions / language names to run commands
const getRunCommand = (fileName: string, language: string): string | null => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = language.toLowerCase();

  // JavaScript / TypeScript
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext) || lang.includes('javascript') || lang.includes('typescript')) {
    return `node "${fileName}"`;
  }

  // Python
  if (ext === 'py' || lang.includes('python')) {
    return `python "${fileName}"`;
  }

  // C
  if (ext === 'c' || lang === 'c') {
    return `gcc "${fileName}" -o output.out 2>&1 && "./output.out" 2>&1`;
  }

  // C++
  if (['cpp', 'cc', 'cxx', 'c++', 'hpp'].includes(ext) || lang.includes('c++') || lang === 'cpp') {
    return `g++ "${fileName}" -o output.out 2>&1 && "./output.out" 2>&1`;
  }

  // C#
  if (ext === 'cs' || lang.includes('csharp') || lang === 'c#') {
    return `dotnet script "${fileName}" 2>&1 || (csc "/out:output.exe" "${fileName}" 2>&1 && "output.exe" 2>&1)`;
  }

  // Go
  if (ext === 'go' || lang === 'go') {
    return `go run "${fileName}" 2>&1`;
  }

  // Rust
  if (ext === 'rs' || lang === 'rust') {
    return `rustc "${fileName}" -o output 2>&1 && "./output" 2>&1`;
  }

  // Java
  if (ext === 'java' || lang === 'java') {
    return `java "${fileName}" 2>&1`;
  }

  // PHP
  if (ext === 'php' || lang === 'php') {
    return `php "${fileName}" 2>&1`;
  }

  // Ruby
  if (ext === 'rb' || lang === 'ruby') {
    return `ruby "${fileName}" 2>&1`;
  }

  // Bash / Shell
  if (['sh', 'bash', 'zsh'].includes(ext) || lang.includes('shell') || lang === 'bash' || lang === 'sh') {
    return `bash "${fileName}" 2>&1`;
  }

  // HTML (just open / serve)
  if (ext === 'html' || lang === 'html') {
    return `echo "Open this file in a browser to view: ${fileName}"`;
  }

  // SQL (can't run standalone)
  if (ext === 'sql' || lang === 'sql') {
    return `echo "SQL query ready to execute on your database."`;
  }

  // Default: echo unsupported
  return `echo "Unsupported language for auto-run: ${lang}. Use the terminal manually."`;
};

// Get the file extension for writing
const getFileExtension = (lang: string): string => {
  const map: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    php: 'php',
    ruby: 'rb',
    bash: 'sh',
    shell: 'sh',
    html: 'html',
    css: 'css',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    lua: 'lua',
    kotlin: 'kt',
    swift: 'swift',
    dart: 'dart',
    r: 'r',
    scala: 'scala',
    haskell: 'hs',
  };
  return map[lang.toLowerCase()] || lang.toLowerCase();
};

export default function Terminal({ projectId, language, code, fileName, fileLanguage }: TerminalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [output, setOutput] = useState<TerminalLine[]>([
    { type: 'output', text: `CodeSynce Terminal v1.0.0` },
    { type: 'output', text: `Project workspace ready. Language: ${language}` },
    { type: 'output', text: `Type 'help' to see available commands.` },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState('~');
  const [loading, setLoading] = useState(false);
  const [runningCode, setRunningCode] = useState(false);
  const [executionInput, setExecutionInput] = useState('');
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const outputRef = useRef<HTMLDivElement>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [output]);

  // Format cwd to show just the project name
  const formatCwd = (path: string) => {
    if (!path || path === '/') return '~';
    const parts = path.split(/[\\/]/).filter(Boolean);
    if (parts.length === 0) return '~';
    // Show last 2 parts for context
    const lastParts = parts.slice(-2);
    return '~/' + lastParts.join('/');
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Add to history
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Add command to output
    setOutput((prev) => [...prev, { type: 'input', text: `${formatCwd(cwd)} $ ${trimmed}` }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOutput((prev) => [
          ...prev,
          { type: 'error', text: data.error || 'Command failed' },
          { type: 'output', text: '' },
        ]);
        return;
      }

      // Update cwd
      if (data.cwd) setCwd(data.cwd);

      // Add output lines
      if (data.output && Array.isArray(data.output)) {
        data.output.forEach((line: string) => {
          if (line === '__CLEAR__') {
            setOutput([]);
          } else {
            setOutput((prev) => [
              ...prev,
              { type: line.startsWith('bash:') || line.startsWith('ls:') || line.startsWith('cd:') || line.startsWith('mkdir:') || line.startsWith('touch:') || line.startsWith('cat:') || line.startsWith('rm:') || line.startsWith('echo:') || line.startsWith("'") || line.startsWith('make:') || line.startsWith('g++:') || line.startsWith('gcc:') || line.startsWith('error:') ? 'error' : 'output', text: line },
            ]);
          }
        });
        setOutput((prev) => [...prev, { type: 'output', text: '' }]);
      }
    } catch (err) {
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: 'Failed to execute command' },
        { type: 'output', text: '' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCode = async () => {
    if (!code || !fileName) {
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: 'No code to run. Open a file first.' },
        { type: 'output', text: '' },
      ]);
      return;
    }

    setIsOpen(true);
    setRunningCode(true);
    setExecutionStatus('running');
    const controller = new AbortController();
    runAbortRef.current = controller;
    setOutput((prev) => [
      ...prev,
      { type: 'input', text: `${formatCwd(cwd)} $ ▶ Run Code (${fileLanguage || language})` },
    ]);

    try {
      const res = await fetch(`/api/projects/${projectId}/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName, fileLanguage, stdin: executionInput, runCode: true }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setOutput((prev) => [
          ...prev,
          { type: 'error', text: data.error || 'Failed to run code' },
          { type: 'output', text: '' },
        ]);
        setExecutionStatus('failed');
        return;
      }

      if (data.cwd) setCwd(data.cwd);

      if (data.output && Array.isArray(data.output)) {
        data.output.forEach((line: string) => {
          setOutput((prev) => [
            ...prev,
            { type: 'output', text: line },
          ]);
        });
      }
      if (data.errors && Array.isArray(data.errors)) {
        data.errors.forEach((line: string) => {
          setOutput((prev) => [...prev, { type: 'error', text: line }]);
        });
      }
      setOutput((prev) => [...prev, { type: 'output', text: '' }]);
      setExecutionStatus(data.status === 'failed' ? 'failed' : 'completed');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setOutput((prev) => [...prev, { type: 'error', text: 'Execution stopped.' }, { type: 'output', text: '' }]);
        setExecutionStatus('stopped');
        return;
      }
      setOutput((prev) => [
        ...prev,
        { type: 'error', text: 'Failed to run code' },
        { type: 'output', text: '' },
      ]);
      setExecutionStatus('failed');
    } finally {
      setRunningCode(false);
      runAbortRef.current = null;
    }
  };

  const handleStopCode = () => {
    runAbortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? -1 : Math.min(history.length - 1, historyIndex + 1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? '' : history[newIndex]);
    }
  };

  return (
    <div className="bg-dark-900 border-t border-dark-600 flex flex-col h-56 shrink-0">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-dark-800 border-b border-dark-600 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">CONSOLE</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">{formatCwd(cwd)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
            executionStatus === 'running' ? 'bg-yellow-500/20 text-yellow-300' :
            executionStatus === 'completed' ? 'bg-green-500/20 text-green-400' :
            executionStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
            executionStatus === 'stopped' ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-700 text-gray-400'
          }`}>
            {executionStatus === 'idle' ? 'Ready' : executionStatus[0].toUpperCase() + executionStatus.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={runningCode || !code}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              runningCode || !code
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
            title="Run code (Ctrl+Enter)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v10a2 2 0 002 2h4l5 5V5a2 2 0 00-2-2H7a2 2 0 00-2 2z" />
            </svg>
            {runningCode ? 'Running...' : 'Run'}
          </button>
          {runningCode && (
            <button
              type="button"
              onClick={handleStopCode}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
              title="Stop execution"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth="2" />
              </svg>
              Stop
            </button>
          )}
          {isOpen && (
            <button
              onClick={() => setOutput([])}
              className="text-gray-500 hover:text-white text-xs"
              title="Clear"
            >
              🗑️
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-400 hover:text-white"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-dark-700 shrink-0">
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1" htmlFor="execution-input">Program input</label>
            <textarea
              id="execution-input"
              value={executionInput}
              onChange={(event) => setExecutionInput(event.target.value)}
              className="w-full h-14 resize-none rounded bg-dark-950 border border-dark-700 px-2 py-1.5 font-mono text-xs text-gray-200 outline-none focus:border-primary-500"
              placeholder="Optional stdin, passed to the program when you run it"
              disabled={runningCode}
            />
          </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1" ref={outputRef}>
          {output.map((line, i) => (
            <div
              key={i}
              className={
                line.type === 'input'
                  ? 'text-green-400'
                  : line.type === 'error'
                  ? 'text-red-400'
                  : 'text-gray-300'
              }
            >
              {line.text}
            </div>
          ))}

          {loading && (
            <div className="text-gray-500">...</div>
          )}

          {/* Input line */}
          <div className="flex items-center gap-1">
            <span className="text-green-400">{formatCwd(cwd)} $</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-white flex-1 outline-none font-mono text-xs"
              placeholder="Type a command..."
              disabled={loading}
            />
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
