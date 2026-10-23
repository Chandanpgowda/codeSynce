'use client';

import { useEffect, useRef, useState } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  icon?: string;
  category?: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  onFileSearch?: (query: string) => { path: string; name: string }[];
  files?: any[];
  onOpenFile?: (path: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
  onFileSearch,
  files = [],
  onOpenFile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<{ path: string; name: string }[]>([]);
  const [hasSearchedFiles, setHasSearchedFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setHasSearchedFiles(false);
      setFilteredCommands(commands);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, commands]);

  // Filter commands based on query
  useEffect(() => {
    if (!isOpen) return;

    const q = query.trim().toLowerCase();
    setHasSearchedFiles(false);

    let cmds = commands;
    let matchedFiles: { path: string; name: string }[] = [];
    let searched = false;

    if (q) {
      cmds = commands.filter((c) => {
        return (
          c.label.toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q) ||
          (c.shortcut || '').toLowerCase().includes(q)
        );
      });

      // Also search files if provided (for Ctrl+P / Ctrl+O quick open)
      if (onFileSearch) {
        const fileResults = onFileSearch(q);
        if (fileResults.length > 0) {
          matchedFiles = fileResults;
          searched = true;
        }
      }
    }

    setFilteredCommands(cmds);
    setFilteredFiles(matchedFiles);
    setHasSearchedFiles(searched);
    setSelectedIndex(0);
  }, [query, isOpen, commands, files, onFileSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const totalItems = filteredCommands.length + filteredFiles.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (hasSearchedFiles && selectedIndex < filteredFiles.length) {
          const file = filteredFiles[selectedIndex];
          onOpenFile?.(file.path);
          onClose();
        } else if (selectedIndex < filteredCommands.length) {
          const cmd = filteredCommands[selectedIndex];
          cmd.action();
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, filteredFiles, selectedIndex, hasSearchedFiles, onClose, onOpenFile]);

  const allItems = [
    ...filteredFiles.map((f) => ({ kind: 'file' as const, path: f.path, name: f.name })),
    ...filteredCommands.map((c) => ({ kind: 'command' as const, ...c })),
  ];

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
        onClick={onClose}
      />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw] z-[100]">
        <div className="bg-dark-800 border border-dark-500 rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-600">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or file name..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
            />
            <span className="text-[10px] text-gray-500 border border-dark-500 rounded px-1.5 py-0.5">
              ESC
            </span>
          </div>

          {/* Results */}
          <div className="max-h-[350px] overflow-y-auto py-1">
            {allItems.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No matching commands or files
              </div>
            )}

            {filteredFiles.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Files
              </div>
            )}

            {filteredFiles.map((file, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={file.path}
                  onClick={() => {
                    onOpenFile?.(file.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 text-sm transition-colors ${
                    isSelected ? 'bg-primary-600/30 text-white' : 'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500 text-xs">📄</span>
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500 truncate">{file.path}</span>
                </button>
              );
            })}

            {hasSearchedFiles && filteredCommands.length > 0 && (
              <div className="border-t border-dark-600 my-1" />
            )}

            {filteredCommands.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                {query ? 'Commands' : 'Quick Actions'}
              </div>
            )}

            {filteredCommands.map((cmd, idx) => {
              const isSelected = selectedIndex === (filteredFiles.length + idx);
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(filteredFiles.length + idx)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 text-sm transition-colors ${
                    isSelected ? 'bg-primary-600/30 text-white' : 'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500 text-xs w-4">{cmd.icon || '⌘'}</span>
                  <span className="flex-1">{cmd.label}</span>
                  {cmd.category && (
                    <span className="text-[10px] text-gray-600 px-1.5 py-0.5 bg-dark-700 rounded uppercase tracking-wide">
                      {cmd.category}
                    </span>
                  )}
                  {cmd.shortcut && (
                    <span className="text-[10px] text-gray-500 border border-dark-500 rounded px-1.5 py-0.5">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-dark-600 bg-dark-900/50">
            <div className="flex items-center gap-4 text-[10px] text-gray-500">
              <span><kbd className="text-gray-400">↑</kbd> <kbd className="text-gray-400">↓</kbd> Navigate</span>
              <span><kbd className="text-gray-400">↵</kbd> Select</span>
              <span><kbd className="text-gray-400">ESC</kbd> Dismiss</span>
            </div>
            <span className="text-[10px] text-gray-600">
              {allItems.length} result{allItems.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}