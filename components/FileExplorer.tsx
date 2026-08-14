'use client';

import { useState, useEffect } from 'react';

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
  const [renaming, setRename] = useState<string | null>(null);
  const [renameItem, setRenameItem] = useState<{ path: string; oldName: string } | null>(null);

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
          parentPath,
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
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) {
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
      onFilesChange();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const handleRename = async (path: string, oldName: string) => {
    const newName = prompt(`Rename "${oldName}" to:`, newItemName || '');
    if (newName === null || newName.trim() === '') {
      setRename(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, oldName, newName: newName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to rename');
        setRename(null);
        return;
      }

      setRename(null);
      onFilesChange();
    } catch (error) {
      alert('Failed to rename');
      setRename(null);
    }
  };

  const renderTree = (items: ProjectFile[], level: number) => {
    return items.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFolders.has(item.path);
      const isActive = activeFile?.path === item.path;
      const isRenaming = renameItem?.path === item.path && item.name === renameItem.oldName;

      return (
        <div key={item.path} className="relative">
          <div
            className={`group flex items-center gap-1 px-1 py-1 text-sm cursor-pointer transition-colors ${
              isActive
                ? 'bg-primary-600/20 text-white border-l-2 border-primary-600'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
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
            <span className="text-xs w-4">
              {isFolder ? (isExpanded ? '▼' : '▶') : getFileIcon(item)}
            </span>
            <span className="truncate flex-1">{item.name}</span>

            {/* Rename overlay */}
            {isRenaming && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <input
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(item.path, renameItem.oldName);
                    if (e.key === 'Escape') setRename(null);
                  }}
                  placeholder="rename"
                  className="bg-dark-900 border border-primary-600 rounded text-white text-xs px-2 py-0.5 outline-none"
                />
                <button
                  onClick={() => handleRename(item.path, renameItem.oldName)}
                  className="text-green-500 text-xs hover:text-green-400"
                >
                  ✓
                </button>
                <button
                  onClick={() => setRename(null)}
                  className="text-red-500 text-xs hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Hover actions for files */}
            {!isFolder && !isRenaming && (
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, item.path, 'file');
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  ⋮
                </button>
              </div>
            )}

            {isFolder && isExpanded && (
              <div>
                {renderTree(item.children || [], level + 1)}
                {creatingIn === item.path && (
                  <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
                    <span className="text-xs">
                      {newItemType === 'folder' ? '📁' : '📄'}
                    </span>
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
        </div>
      );
    });
  };

  return (
    <div className={`bg-dark-800 border-r border-dark-600 flex flex-col ${isOpen ? 'w-60' : 'w-10'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600">
        {isOpen && (
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                className="text-gray-400 hover:text-white p-1"
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
                className="text-gray-400 hover:text-white p-1"
                title="New Folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-400 hover:text-white transition-colors"
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
        <div className="flex-1 overflow-y-auto py-2">
          {renderTree(files, 0)}

          {creatingIn === '__root__' && (
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="text-xs">
                {newItemType === 'folder' ? '📁' : '📄'}
              </span>
              <input
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate(null);
                  if (e.key === 'Escape') setCreatingIn(null);
                }}
                placeholder={newItemType === 'folder' ? 'folder name' : 'file.ts'}
                className="bg-dark-900 border border-primary-600 rounded text-white text-xs px-2 py-0.5 flex-1 outline-none"
              />
              <button
                onClick={() => handleCreate(null)}
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

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-50 bg-dark-700 border border-dark-500 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
              onClick={() => {
                const parent = contextMenu.type === 'folder' ? contextMenu.path : null;
                setCreatingIn(parent || '__root__');
                setNewItemType('file');
                setNewItemName('');
                setContextMenu(null);
              }}
            >
              📄 New File
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
              onClick={() => {
                const parent = contextMenu.type === 'folder' ? contextMenu.path : null;
                setCreatingIn(parent || '__root__');
                setNewItemType('folder');
                setNewItemName('');
                setContextMenu(null);
              }}
            >
              📁 New Folder
            </button>
            <div className="border-t border-dark-500 my-1" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-dark-600 transition-colors"
              onClick={() => handleDelete(contextMenu.path)}
            >
              🗑️ Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}