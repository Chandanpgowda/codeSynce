'use client';

import { useEffect, useRef, useState } from 'react';

interface ProjectFile {
  name: string;
  path: string;
  content?: string;
  language?: string;
  type?: 'file' | 'folder';
  children?: ProjectFile[];
}

interface FileExplorerProps {
  projectId: string;
  files: ProjectFile[];
  activeFile: ProjectFile | null;
  onFileSelect: (file: ProjectFile) => void;
  onFilesChange: () => void;
}

const FILE_ICONS: Record<string, string> = {
  javascript: '🟨',
  typescript: '🟦',
  python: '🐍',
  java: '☕',
  c: '🔵',
  cpp: '🔷',
  csharp: '🟣',
  go: '🔷',
  rust: '🦀',
  ruby: '💎',
  php: '🐘',
  html: '🌐',
  css: '🎨',
  json: '📋',
  sql: '🗄️',
  markdown: '📝',
  yaml: '⚙️',
  shell: '🐚',
  plaintext: '📄',
};

const LANGUAGE_ICONS: Record<string, string> = {
  javascript: '📘',
  typescript: '📘',
  python: '🐍',
  java: '☕',
  c: '📁',
  cpp: '📁',
  csharp: '📁',
  go: '📁',
  rust: '📁',
  ruby: '📁',
  php: '📁',
  html: '🌐',
  css: '🎨',
  json: '📋',
  sql: '🗄️',
  markdown: '📝',
  plaintext: '📄',
};

function isExcludedFile(name: string): boolean {
  const excluded = ['.git', 'node_modules', '.next', 'dist', '.env', '.env.local', '__pycache__', '.DS_Store'];
  return excluded.some((e) => name === e || name.startsWith('.next'));
}

function findParentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.substring(0, idx);
}

export default function FileExplorer({ projectId, files, activeFile, onFileSelect, onFilesChange }: FileExplorerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    type: 'file' | 'folder' | 'root';
  } | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rootOpen, setRootOpen] = useState(true);

  const getFileIcon = (file: ProjectFile) => {
    if (file.type === 'folder') return '📁';
    return FILE_ICONS[file.language || ''] || '📄';
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder' | 'root') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, type });
  };

  const handleCreate = async (parentPath: string | null) => {
    if (!newItemName.trim()) {
      setCreatingIn(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newItemType,
          name: newItemName.trim(),
          parentPath: parentPath === '__root__' ? null : parentPath,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create');
        return;
      }

      setNewItemName('');
      setCreatingIn(null);
      setContextMenu(null);

      // Auto-expand parent folder
      if (parentPath && parentPath !== '__root__') {
        setExpandedFolders((prev) => new Set(prev).add(parentPath));
      }

      onFilesChange();

      // If a file was created, open it
      if (newItemType === 'file' && data.item) {
        onFileSelect(data.item);
      }
    } catch (error) {
      alert('Failed to create item');
    }
  };

  const handleDelete = async (path: string) => {
    setDeleting(path);
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) {
      setDeleting(null);
      setContextMenu(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert('Failed to delete');
        return;
      }

      setContextMenu(null);
      // Remove from expanded set if folder
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.forEach((p) => {
          if (p === path || p.startsWith(path + '/')) next.delete(p);
        });
        return next;
      });
      onFilesChange();
    } catch (error) {
      alert('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (path: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === path.split('/').pop()) {
      setRenamingPath(null);
      return;
    }
    const oldName = path.split('/').pop() || '';

    try {
      const res = await fetch(`/api/projects/${projectId}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, oldName, newName }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to rename');
        setRenamingPath(null);
        return;
      }

      setRenamingPath(null);
      onFilesChange();
    } catch (error) {
      alert('Failed to rename');
      setRenamingPath(null);
    }
  };

  const startRename = (path: string) => {
    const name = path.split('/').pop() || '';
    setRenamingPath(path);
    setRenameValue(name);
    setContextMenu(null);
  };

  function findFileContent(items: ProjectFile[], targetPath: string): ProjectFile | null {
    for (const item of items) {
      if (item.path === targetPath) return item;
      if (item.children) {
        const found = findFileContent(item.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  const handleDuplicate = async (path: string) => {
    if (!contextMenu) return;
    const item = findFileContent(files, path);
    if (!item) {
      alert('File not found');
      return;
    }

    const parentPath = findParentPath(path);
    const originalName = path.split('/').pop() || '';
    const newName = `copy_${originalName}`;

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'file',
          name: newName,
          parentPath: parentPath || null,
          content: item.content || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to duplicate');
        return;
      }

      setContextMenu(null);
      onFilesChange();
    } catch (error) {
      alert('Failed to duplicate');
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setContextMenu(null);
  };


  const renderTree = (items: ProjectFile[], level: number) => {
    const filtered = items.filter((item) => !isExcludedFile(item.name));
    if (filtered.length === 0 && level > 0) return null;

    return filtered.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFolders.has(item.path);
      const isActive = activeFile?.path === item.path;
      const isRenaming = renamingPath === item.path;

      return (
        <div key={item.path} className="relative">
          <div
            className={`group flex items-center gap-1 px-1 py-[3px] text-[13px] cursor-pointer transition-colors select-none ${
              isActive
                ? 'bg-primary-600/20 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700/70'
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              if (isFolder) {
                setExpandedFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(item.path)) {
                    next.delete(item.path);
                  } else {
                    next.add(item.path);
                  }
                  return next;
                });
              } else {
                onFileSelect(item);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, item.path, isFolder ? 'folder' : 'file')}
          >
            <span className="text-[10px] w-4 text-gray-500 shrink-0">
              {isFolder ? (
                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <span className="text-xs">{getFileIcon(item)}</span>
              )}
            </span>

            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRename(item.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(item.path);
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-dark-900 border border-primary-600 rounded text-white text-xs px-1.5 py-0.5 flex-1 outline-none min-w-0"
              />
            ) : (
              <span className="truncate flex-1">{item.name}</span>
            )}

            {/* Hover actions */}
            {!isRenaming && (
              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(item.path);
                  }}
                  className="p-0.5 text-gray-500 hover:text-white"
                  title="Rename"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {!isFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, item.path, 'file');
                    }}
                    className="p-0.5 text-gray-500 hover:text-white"
                    title="More actions"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {isFolder && isExpanded && item.children && (
            <div>
              {renderTree(item.children, level + 1)}
              {creatingIn === item.path && (
                <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
                  <span className="text-xs">{newItemType === 'folder' ? '📁' : '📄'}</span>
                  <input
                    autoFocus
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate(item.path);
                      if (e.key === 'Escape') setCreatingIn(null);
                    }}
                    placeholder={newItemType === 'folder' ? 'folder name' : 'file.ts'}
                    className="bg-dark-900 border border-primary-600 rounded text-white text-xs px-2 py-0.5 flex-1 outline-none"
                  />
                  <button
                    onClick={() => handleCreate(item.path)}
                    className="text-green-500 text-xs hover:text-green-400"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setCreatingIn(null)}
                    className="text-red-500 text-xs hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={`bg-[#161b22] border-r border-[#21262d] flex flex-col ${isOpen ? 'w-60' : 'w-10'} shrink-0`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d]">
        {isOpen && (
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
            Explorer
          </span>
        )}
        <div className="flex items-center gap-1">
          {isOpen && (
            <>
              <button
                onClick={() => {
                  setCreatingIn('__root__');
                  setNewItemType('file');
                  setNewItemName('');
                }}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d]"
                title="New File"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setCreatingIn('__root__');
                  setNewItemType('folder');
                  setNewItemName('');
                }}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d]"
                title="New Folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              <button
                onClick={() => setRootOpen(!rootOpen)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d]"
                title="Collapse/Expand"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${rootOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d]"
            title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Files Tree */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto py-1.5">
          <div
            className="flex items-center gap-1 px-2 py-[3px] text-[11px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-white"
            onClick={() => setRootOpen(!rootOpen)}
          >
            <svg className={`w-3 h-3 transition-transform ${rootOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>PROJECT-{String(projectId).slice(-8).toUpperCase()}</span>
          </div>

          {rootOpen && (
            <div>
              {renderTree(files, 0)}

              {creatingIn === '__root__' && (
                <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: '20px' }}>
                  <span className="text-xs">{newItemType === 'folder' ? '📁' : '📄'}</span>
                  <input
                    autoFocus
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate('__root__');
                      if (e.key === 'Escape') setCreatingIn(null);
                    }}
                    placeholder={newItemType === 'folder' ? 'folder name' : 'file.ts'}
                    className="bg-[#0d1117] border border-primary-600 rounded text-white text-xs px-2 py-0.5 flex-1 outline-none"
                  />
                  <button
                    onClick={() => handleCreate('__root__')}
                    className="text-green-500 text-xs hover:text-green-400"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setCreatingIn(null)}
                    className="text-red-500 text-xs hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-50 bg-[#21262d] border border-[#30363d] rounded-md shadow-2xl py-1 min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-gray-300 hover:bg-[#30363d] transition-colors flex items-center gap-2"
              onClick={() => {
                const parent = contextMenu.type === 'folder' ? contextMenu.path : null;
                setCreatingIn(parent || '__root__');
                setNewItemType('file');
                setNewItemName('');
                setContextMenu(null);
              }}
            >
              <span className="text-xs">📄</span> New File
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-gray-300 hover:bg-[#30363d] transition-colors flex items-center gap-2"
              onClick={() => {
                const parent = contextMenu.type === 'folder' ? contextMenu.path : null;
                setCreatingIn(parent || '__root__');
                setNewItemType('folder');
                setNewItemName('');
                setContextMenu(null);
              }}
            >
              <span className="text-xs">📁</span> New Folder
            </button>
            <div className="border-t border-[#30363d] my-1" />
            {contextMenu.type !== 'root' && (
              <>
                <button
                  className="w-full text-left px-3 py-1.5 text-[13px] text-gray-300 hover:bg-[#30363d] transition-colors flex items-center gap-2"
                  onClick={() => startRename(contextMenu.path)}
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Rename
                </button>
                {contextMenu.type === 'file' && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-[13px] text-gray-300 hover:bg-[#30363d] transition-colors flex items-center gap-2"
                    onClick={() => handleDuplicate(contextMenu.path)}
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 16v2a2 2 0 002 2h4a2 2 0 002-2v-2m-6-4l3-3 3 3" />
                    </svg>
                    Duplicate
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-1.5 text-[13px] text-gray-300 hover:bg-[#30363d] transition-colors flex items-center gap-2"
                  onClick={() => handleCopyPath(contextMenu.path)}
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8m-5-4l4-4 4 4" />
                  </svg>
                  Copy Path
                </button>
                <div className="border-t border-[#30363d] my-1" />
              </>
            )}
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-400 hover:bg-[#30363d] transition-colors flex items-center gap-2"
              onClick={() => handleDelete(contextMenu.path)}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}