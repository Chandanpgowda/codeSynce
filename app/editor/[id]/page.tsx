'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import ChatPanel from '@/components/ChatPanel';
import AIPanel from '@/components/AIPanel';
import FileExplorer from '@/components/FileExplorer';
import Terminal from '@/components/Terminal';
import CommandPalette, { CommandItem } from '@/components/CommandPalette';
import SearchAndReplace from '@/components/SearchAndReplace';

interface ProjectFile {
  name: string;
  path: string;
  content?: string;
  language?: string;
  type?: 'file' | 'folder';
  children?: ProjectFile[];
}

interface Project {
  _id: string;
  name: string;
  description: string;
  owner: {
    _id: string;
    name: string;
    email: string;
    image?: string;
  };
  members: Array<{
    _id: string;
    name: string;
    email: string;
    image?: string;
  }>;
  pendingRequests: Array<{
    _id: string;
    name: string;
    email: string;
    image?: string;
  }>;
  files: ProjectFile[];
  language: string;
  tags: string[];
}

interface ChatMessage {
  user: {
    _id: string;
    name: string;
    image?: string;
  };
  message: string;
  timestamp: string;
}

interface OpenTab {
  file: ProjectFile;
  isDirty: boolean;
}

// Custom dark theme for Monaco
const CUSTOM_THEMES = {
  'vs-code-dark': {
    base: 'vs-dark' as 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'tag', foreground: '569CD6' },
      { token: 'attribute.name', foreground: '9CDCFE' },
      { token: 'attribute.value', foreground: 'CE9178' },
      { token: 'identifier', foreground: '9CDCFE' },
      { token: 'constant', foreground: '4FC1FF' },
      { token: 'regexp', foreground: 'D16969' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editor.lineHighlightBackground': '#2d2d2d',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorCursor.foreground': '#aeafad',
      'editorIndentGuide.background1': '#404040',
      'editorIndentGuide.activeBackground1': '#707070',
      'editorBracketMatch.background': '#ffffff20',
      'editorBracketMatch.border': '#ffffff20',
      'editorWidget.background': '#252526',
      'editorWidget.border': '#454545',
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.selectedBackground': '#04395e',
      'editorHoverWidget.background': '#252526',
      'editorHoverWidget.border': '#454545',
      'scrollbarSlider.background': '#79797933',
      'scrollbarSlider.hoverBackground': '#64646466',
      'scrollbarSlider.activeBackground': '#bfbfbf66',
      'minimap.background': '#1e1e1e',
      'minimapSlider.background': '#79797933',
    },
  },
  'vs-code-light': {
    base: 'vs' as 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
      { token: 'operator', foreground: '000000' },
      { token: 'tag', foreground: '800000' },
      { token: 'attribute.name', foreground: 'FF0000' },
      { token: 'attribute.value', foreground: '0000FF' },
      { token: 'identifier', foreground: '001080' },
      { token: 'constant', foreground: '0070C1' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#f3f3f3',
      'editorLineNumber.foreground': '#237893',
      'editorLineNumber.activeForeground': '#0b216f',
      'editor.selectionBackground': '#add6ff',
      'editorCursor.foreground': '#000000',
      'editorIndentGuide.background1': '#d3d3d3',
      'editorWidget.background': '#f3f3f3',
      'editorWidget.border': '#c8c8c8',
      'editorSuggestWidget.background': '#f3f3f3',
      'editorSuggestWidget.selectedBackground': '#cee4fc',
      'editorHoverWidget.background': '#f3f3f3',
      'editorHoverWidget.border': '#c8c8c8',
      'scrollbarSlider.background': '#c1c1c1',
      'minimap.background': '#f5f5f5',
    },
  },
  'github-dark': {
    base: 'vs-dark' as 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8b949e' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'ffa657' },
      { token: 'operator', foreground: 'ff7b72' },
      { token: 'tag', foreground: '7ee787' },
      { token: 'attribute.name', foreground: 'ffa657' },
      { token: 'attribute.value', foreground: 'a5d6ff' },
      { token: 'identifier', foreground: 'ffa657' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#c9d1d9',
      'editor.lineHighlightBackground': '#161b22',
      'editorLineNumber.foreground': '#484f58',
      'editorLineNumber.activeForeground': '#c9d1d9',
      'editor.selectionBackground': '#264f78',
      'editorCursor.foreground': '#58a6ff',
      'editorIndentGuide.background1': '#21262d',
      'editorWidget.background': '#161b22',
      'editorWidget.border': '#30363d',
    },
  },
  'dark-plus': {
    base: 'vs-dark' as 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2D2D2D',
    },
  },
} as const;

// Helper to find the first file in the tree
function findFirstFile(items: ProjectFile[]): ProjectFile | null {
  for (const item of items) {
    if (item.type !== 'folder' && !item.children) return item;
    if (item.children) {
      const found = findFirstFile(item.children);
      if (found) return found;
    }
  }
  return null;
}

// Helper to find a file by path in the tree
function findFileByPath(items: ProjectFile[], path: string): ProjectFile | null {
  for (const item of items) {
    if (item.path === path) return item;
    if (item.children) {
      const found = findFileByPath(item.children, path);
      if (found) return found;
    }
  }
  return null;
}

// Helper to collect all files from tree
function collectFiles(items: ProjectFile[]): ProjectFile[] {
  const result: ProjectFile[] = [];
  for (const item of items) {
    if (item.type !== 'folder' && !item.children) {
      result.push(item);
    }
    if (item.children) {
      result.push(...collectFiles(item.children));
    }
  }
  return result;
}

// Helper to get file icon based on extension
function getFileIcon(file: ProjectFile): string {
  const icons: Record<string, string> = {
    javascript: '🟨',
    typescript: '🟦',
    python: '🐍',
    java: '☕',
    html: '🌐',
    css: '🎨',
    json: '📋',
    markdown: '📝',
    plaintext: '📄',
  };
  return icons[file.language || ''] || '📄';
}

export const dynamic = 'force-dynamic';

export default function EditorPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activePanel, setActivePanel] = useState<'chat' | 'ai' | 'members'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<string>('vs-code-dark');
  const [showMinimap, setShowMinimap] = useState(true);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [statistics, setStatistics] = useState({ line: 1, column: 1, lineCount: 1, selectedText: '' });
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFormatting, setIsFormatting] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isRemoteUpdateRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<Record<string, string>>({});
  const dirtyTabsRef = useRef<Record<string, boolean>>({});

  // Load project
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchProject();
    }
  }, [status, params.id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load project');
        return;
      }

      if (!data.project) {
        setError('Project data not found');
        return;
      }

      setProject(data.project);

      const files = Array.isArray(data.project.files) ? data.project.files : [];
      const firstFile = findFirstFile(files);
      setActiveFile(firstFile || null);
      if (firstFile) {
        setOpenTabs([{ file: firstFile, isDirty: false }]);
      }

      const userId = session?.user?.id;
      setIsOwner(data.project.owner?._id === userId);
      setIsMember(
        (data.project.members || []).some((m: any) => m._id === userId) ||
        data.project.owner?._id === userId
      );

      if (data.project.chatMessages) {
        setChatMessages(data.project.chatMessages);
      }
    } catch (err) {
      console.error('fetchProject error:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Register custom Monaco themes
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    Object.entries(CUSTOM_THEMES).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as any);
    });
  }, [monacoRef.current]);

  // Setup socket connection
  useEffect(() => {
    if (!project || !isMember) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : undefined);

    if (!process.env.NEXT_PUBLIC_SOCKET_URL) {
      console.error(
        '[CodeSynce] NEXT_PUBLIC_SOCKET_URL is not set.\n' +
          '  Add it in Vercel: Settings -> Environment Variables -> NEXT_PUBLIC_SOCKET_URL\n' +
          '  Point it to your Railway socket server (e.g. https://your-app.up.railway.app).\n' +
          '  Then redeploy - env changes require a fresh build.'
      );
    }

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.emit('join-project', {
      projectId: project._id,
      user: {
        _id: session?.user?.id,
        name: session?.user?.name,
        image: session?.user?.image,
      },
    });

    socket.on('user-joined', ({ users }) => {
      setOnlineUsers(users);
    });

    socket.on('user-left', ({ users }) => {
      setOnlineUsers(users);
    });

    socket.on('new-message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit('leave-project', { projectId: project._id });
      socket.disconnect();
    };
  }, [project?._id, isMember]);

  // Listen for remote file updates
  useEffect(() => {
    if (!socketRef.current) return;

    const handleFileUpdated = ({ file, content }: { file: string; content: string }) => {
      if (file === activeFile?.path && editorRef.current) {
        isRemoteUpdateRef.current = true;
        editorRef.current.setValue(content);
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 100);
      }
    };

    socketRef.current.on('file-updated', handleFileUpdated);

    return () => {
      socketRef.current?.off('file-updated', handleFileUpdated);
    };
  }, [activeFile?.path]);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom themes
    Object.entries(CUSTOM_THEMES).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as any);
    });

    // Set initial theme
    monaco.editor.setTheme(theme);

    // Track cursor position for status bar
    editor.onDidChangeCursorPosition((e: any) => {
      const model = editor.getModel();
      if (model) {
        setStatistics({
          line: e.position.lineNumber,
          column: e.position.column,
          lineCount: model.getLineCount(),
          selectedText: '',
        });
      }

      socketRef.current?.emit('cursor-update', {
        projectId: project?._id,
        position: e.position,
        user: {
          _id: session?.user?.id,
          name: session?.user?.name,
        },
      });
    });

    editor.onDidChangeCursorSelection((e: any) => {
      const model = editor.getModel();
      if (model) {
        const selection = e.selection;
        const selectedText = selection.isEmpty() ? '' : model.getValueInRange(selection);
        setStatistics((prev) => ({
          ...prev,
          selectedText,
          line: selection.positionLineNumber,
          column: selection.positionColumn,
        }));
      }
    });

    // Error highlighting - listen for marker changes
    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({ resource: editor.getModel()?.uri });
      setErrors(markers || []);
    });

    // Keyboard shortcuts inside editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFile) {
        saveFile(activeFile.path, editor.getValue());
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.file.path === activeFile.path ? { ...tab, isDirty: false } : tab
          )
        );
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setSearchOpen(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      setSearchOpen(true);
    });

    // Format document: Shift+Alt+F
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => formatDocument()
    );
  };

  const [errors, setErrors] = useState<any[]>([]);

  // Save file content to the database (debounced)
  const saveFile = useCallback((filePath: string, content: string) => {
    if (!project) return;

    // Skip if content hasn't changed since last save
    if (lastSavedContentRef.current[filePath] === content) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 800ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${project._id}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content }),
        });

        if (res.ok) {
          lastSavedContentRef.current[filePath] = content;
        }
      } catch (err) {
        console.error('Failed to save file:', err);
      }
    }, 800);
  }, [project]);

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !project || !activeFile) return;
    if (isRemoteUpdateRef.current) return;

    // Update local state
    const updatedFile = { ...activeFile, content: value };

    // Mark tab as dirty
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.file.path === activeFile.path ? { ...tab, file: updatedFile, isDirty: true } : tab
      )
    );
    dirtyTabsRef.current[activeFile.path] = true;

    // Also update activeFile reference
    setActiveFile(updatedFile);

    // Broadcast file change to other users
    socketRef.current?.emit('file-change', {
      projectId: project._id,
      file: activeFile.path,
      content: value,
    });

    // Auto-save to database so code persists across sessions
    saveFile(activeFile.path, value);
  };

  // Format document using Monaco's built-in formatter
  const formatDocument = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFile) return;

    setIsFormatting(true);
    try {
      // Use Monaco's format action
      editor.trigger('format-document', 'editor.action.formatDocument', {});
    } catch (err) {
      console.error('Format failed:', err);
      alert('Formatting is not supported for this file type');
    } finally {
      setTimeout(() => setIsFormatting(false), 100);
    }
  }, [activeFile]);

  // Tab management
  const openFileInTab = useCallback((file: ProjectFile) => {
    setOpenTabs((prev) => {
      const existing = prev.find((tab) => tab.file.path === file.path);
      if (existing) return prev;
      return [...prev, { file, isDirty: false }];
    });
    setActiveFile(file);
  }, []);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const tab = prev.find((t) => t.file.path === path);
      if (tab?.isDirty && dirtyTabsRef.current[path]) {
        if (!confirm(`"${tab.file.name}" has unsaved changes. Close anyway?`)) {
          return prev;
        }
      }
      delete dirtyTabsRef.current[path];
      return prev.filter((t) => t.file.path !== path);
    });
  }, []);

  // When closing active tab, switch to adjacent tab
  useEffect(() => {
    const isCurrentTabOpen = openTabs.some((tab) => tab.file.path === activeFile?.path);
    if (!isCurrentTabOpen && openTabs.length > 0) {
      setActiveFile(openTabs[openTabs.length - 1].file);
    } else if (!isCurrentTabOpen && openTabs.length === 0) {
      setActiveFile(null);
    }
  }, [openTabs]);

  const handleAcceptRequest = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${project?._id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'accept' }),
      });

      if (res.ok) {
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleRejectRequest = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${project?._id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reject' }),
      });

      if (res.ok) {
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return;

    try {
      const res = await fetch(
        `/api/projects/${project?._id}?userId=${memberId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to remove member');
        return;
      }

      fetchProject();
    } catch (err) {
      console.error('Failed to remove member:', err);
      alert('Failed to remove member');
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat messages? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/projects/${project?._id}?clearChat=true`, {
        method: 'PUT',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to clear chat');
        return;
      }

      setChatMessages([]);
      alert('Chat messages cleared');
    } catch (err) {
      console.error('Failed to clear chat:', err);
      alert('Failed to clear chat');
    }
  };

  // Build command palette commands
  const commandItems: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'new-file',
        label: 'New File',
        icon: '📄',
        category: 'File',
        shortcut: 'Ctrl+N',
        action: () => {
          const input = prompt('Enter file name (e.g. script.js):');
          if (input && project) {
            fetch(`/api/projects/${project._id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'file', name: input, parentPath: null }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.item) {
                  openFileInTab(data.item);
                  setRefreshKey((k) => k + 1);
                  fetchProject();
                }
              });
          }
        },
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        icon: '📁',
        category: 'File',
        shortcut: '',
        action: () => {
          const input = prompt('Enter folder name:');
          if (input && project) {
            fetch(`/api/projects/${project._id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'folder', name: input, parentPath: null }),
            })
              .then((res) => res.json())
              .then(() => {
                setRefreshKey((k) => k + 1);
                fetchProject();
              });
          }
        },
      },
      {
        id: 'save',
        label: 'Save File',
        icon: '💾',
        category: 'File',
        shortcut: 'Ctrl+S',
        action: () => {
          if (activeFile && editorRef.current) {
            saveFile(activeFile.path, editorRef.current.getValue());
            setOpenTabs((prev) =>
              prev.map((tab) =>
                tab.file.path === activeFile.path ? { ...tab, isDirty: false } : tab
              )
            );
            delete dirtyTabsRef.current[activeFile.path];
          }
        },
      },
      {
        id: 'save-all',
        label: 'Save All Files',
        icon: '💾',
        category: 'File',
        shortcut: '',
        action: () => {
          if (!project) return;
          const allFiles = collectFiles(project.files);
          allFiles.forEach((file) => {
            const tab = openTabs.find((t) => t.file.path === file.path);
            if (tab && tab.isDirty && editorRef.current) {
              // Get latest content from editor for active file
              const content = file.path === activeFile?.path ? editorRef.current.getValue() : file.content || '';
              saveFile(file.path, content);
            }
          });
          setOpenTabs((prev) => prev.map((t) => ({ ...t, isDirty: false })));
          alert('All files saved');
        },
      },
      {
        id: 'find',
        label: 'Find / Replace',
        icon: '🔍',
        category: 'Search',
        shortcut: 'Ctrl+F',
        action: () => setSearchOpen(true),
      },
      {
        id: 'format',
        label: 'Format Document',
        icon: '✨',
        category: 'Editor',
        shortcut: 'Shift+Alt+F',
        action: () => formatDocument(),
      },
      {
        id: 'toggle-minimap',
        label: showMinimap ? 'Hide Minimap' : 'Show Minimap',
        icon: '🗺️',
        category: 'View',
        shortcut: '',
        action: () => setShowMinimap((v) => !v),
      },
      {
        id: 'toggle-sidebar',
        label: showSidebar ? 'Hide Sidebar' : 'Show Sidebar',
        icon: '📑',
        category: 'View',
        shortcut: 'Ctrl+B',
        action: () => setShowSidebar((v) => !v),
      },
      {
        id: 'toggle-terminal',
        label: showTerminal ? 'Hide Terminal' : 'Show Terminal',
        icon: '💻',
        category: 'View',
        shortcut: 'Ctrl+`',
        action: () => setShowTerminal((v) => !v),
      },
      {
        id: 'toggle-breadcrumbs',
        label: showBreadcrumbs ? 'Hide Breadcrumbs' : 'Show Breadcrumbs',
        icon: '🧭',
        category: 'View',
        shortcut: '',
        action: () => setShowBreadcrumbs((v) => !v),
      },
      ...Object.keys(CUSTOM_THEMES).map((themeName): CommandItem => ({
        id: `theme-${themeName}`,
        label: `Theme: ${themeName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
        icon: '🎨',
        category: 'Theme',
        shortcut: '',
        action: () => {
          setTheme(themeName);
          monacoRef.current?.editor.setTheme(themeName);
        },
      })),
      {
        id: 'close-tab',
        label: 'Close Current Tab',
        icon: '✕',
        category: 'File',
        shortcut: 'Ctrl+W',
        action: () => {
          if (activeFile) closeTab(activeFile.path);
        },
      },
      {
        id: 'close-all-tabs',
        label: 'Close All Tabs',
        icon: '🗑️',
        category: 'File',
        shortcut: '',
        action: () => {
          if (openTabs.some((t) => t.isDirty)) {
            if (!confirm('Some files have unsaved changes. Close all anyway?')) return;
          }
          setOpenTabs([]);
          setActiveFile(null);
        },
      },
    ];
  }, [project, activeFile, openTabs, showMinimap, showSidebar, showTerminal, showBreadcrumbs, formatDocument, saveFile, closeTab, openFileInTab, fetchProject, setRefreshKey]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Don't trigger if typing in an input or the command palette is open
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (commandPaletteOpen) return;

      // Ctrl+Shift+P: Command Palette
      if (ctrlOrCmd && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Ctrl+P: Quick Open (search files)
      else if (ctrlOrCmd && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Ctrl+B: Toggle sidebar
      else if (ctrlOrCmd && e.key === 'b' && !isInput) {
        e.preventDefault();
        setShowSidebar((v) => !v);
      }
      // Ctrl+` : Toggle terminal
      else if (ctrlOrCmd && e.key === '`') {
        e.preventDefault();
        setShowTerminal((v) => !v);
      }
      // Ctrl+W: Close current tab (when not in input)
      else if (ctrlOrCmd && e.key === 'w' && !isInput) {
        e.preventDefault();
        if (activeFile) closeTab(activeFile.path);
      }
      // Ctrl+S: Save (when not in input)
      else if (ctrlOrCmd && e.key === 's' && !isInput) {
        e.preventDefault();
        if (activeFile && editorRef.current) {
          saveFile(activeFile.path, editorRef.current.getValue());
          setOpenTabs((prev) =>
            prev.map((tab) =>
              tab.file.path === activeFile.path ? { ...tab, isDirty: false } : tab
            )
          );
          delete dirtyTabsRef.current[activeFile.path];
        }
      }
      // Ctrl+E: Focus file explorer (use Ctrl+Shift+E to avoid conflicts)
      else if (ctrlOrCmd && e.shiftKey && e.key === 'e' && !isInput) {
        e.preventDefault();
        setShowSidebar(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, activeFile, closeTab, saveFile, setShowSidebar, setShowTerminal]);

  // File search for command palette quick open
  const searchFiles = useCallback((query: string): { path: string; name: string }[] => {
    if (!project) return [];
    const allFiles = collectFiles(project.files);
    const q = query.toLowerCase();
    return allFiles
      .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .map((f) => ({ path: f.path, name: f.name }))
      .slice(0, 8);
  }, [project]);

  const handleOpenFileFromSearch = useCallback((path: string) => {
    if (!project) return;
    const file = findFileByPath(project.files, path);
    if (file) {
      openFileInTab(file);
    }
  }, [project, openFileInTab]);

  // Editor options
  const editorOptions = {
    fontSize: 14,
    minimap: { enabled: showMinimap, renderCharacters: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on' as const,
    lineNumbers: 'on' as const,
    folding: true,
    bracketPairColorization: { enabled: true },
    renderWhitespace: 'selection' as const,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    smoothScrolling: true,
    padding: { top: 10, bottom: 10 },
    autoIndent: 'full' as const,
    formatOnPaste: true,
    formatOnType: true,
    renderLineHighlight: 'all' as const,
    lineHeight: 22,
    fontLigatures: true,
    glyphMargin: true,
    quickSuggestions: { other: true, comments: true, strings: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on' as const,
    snippetSuggestions: 'inline' as const,
    scrollbar: {
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    roundedSelection: true,
    mouseWheelZoom: true,
  };

  // Get breadcrumb path segments
  const breadcrumbs = useMemo(() => {
    if (!activeFile) return [];
    const parts = activeFile.path.split('/');
    let acc = '';
    return parts.map((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      return { name: part, path: acc, isLast: i === parts.length - 1 };
    });
  }, [activeFile]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button onClick={() => router.push('/home')} className="btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  if (!isMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">
            You don't have access to this project yet.
          </p>
          <button onClick={() => router.push('/home')} className="btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const bgColor = theme === 'vs-code-light' ? '#ffffff' : '#1e1e1e';
  const textColor = theme === 'vs-code-light' ? '#1a1a1a' : '#cccccc';
  const tabBg = theme === 'vs-code-light' ? '#ffffff' : '#2d2d2d';
  const tabInactiveBg = theme === 'vs-code-light' ? '#ececec' : '#1e1e1e';
  const borderColor = theme === 'vs-code-light' ? '#e0e0e0' : '#333333';
  const panelBg = theme === 'vs-code-light' ? '#f3f3f3' : '#252526';
  const inputBg = theme === 'vs-code-light' ? '#ffffff' : '#3c3c3c';

  return (
    <div className="h-screen flex flex-col" style={{ background: bgColor, color: textColor }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 h-10 shrink-0 border-b" style={{ background: panelBg, borderColor }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/home')}
            className="transition-colors"
            style={{ color: textColor }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: '#007acc', color: 'white' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="font-semibold text-sm">{project.name}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: '#4d4d4d33', color: textColor }}>
            {project.language}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Command Palette button */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
            style={{ background: '#4d4d4d22', color: textColor }}
            title="Command Palette (Ctrl+Shift+P)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="hidden md:inline">Commands</span>
          </button>

          {/* Terminal toggle */}
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              showTerminal ? 'text-blue-400' : ''
            }`}
            style={{ background: '#4d4d4d22', color: showTerminal ? '#4da3ff' : textColor }}
            title="Toggle Terminal (Ctrl+`)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Terminal
          </button>

          {/* Online users */}
          <div className="flex -space-x-1.5">
            {onlineUsers.slice(0, 3).map((user, i) => (
              <div
                key={i}
                title={user.name}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                style={{ background: '#007acc', borderColor: panelBg, color: 'white' }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
            ))}
            {onlineUsers.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px]" style={{ background: '#4d4d4d', borderColor: panelBg, color: 'white' }}>
                +{onlineUsers.length - 3}
              </div>
            )}
          </div>

          {/* Join requests (owner only) */}
          {isOwner && project.pendingRequests.length > 0 && (
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{ background: '#b5890022', color: '#e5c07b' }}
            >
              {project.pendingRequests.length} Request{project.pendingRequests.length > 1 ? 's' : ''}
            </button>
          )}

          {/* User */}
          <div className="flex items-center gap-2">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#007acc', color: 'white' }}>
                {(session?.user?.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs hidden sm:block">{session?.user?.name}</span>
          </div>
        </div>
      </div>

      {/* Join Requests Panel */}
      {showRequests && isOwner && (
        <div className="p-4 border-b shrink-0" style={{ background: panelBg, borderColor }}>
          <h3 className="text-sm font-semibold mb-3">Join Requests</h3>
          <div className="space-y-2">
            {project.pendingRequests.map((user) => (
              <div key={user._id} className="flex items-center justify-between rounded-lg p-3" style={{ background: '#4d4d4d33' }}>
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#007acc', color: 'white' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs opacity-70">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptRequest(user._id)}
                    className="px-3 py-1.5 rounded text-sm hover:opacity-80 transition-opacity"
                    style={{ background: '#3fb95033', color: '#3fb950' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectRequest(user._id)}
                    className="px-3 py-1.5 rounded text-sm hover:opacity-80 transition-opacity"
                    style={{ background: '#f8514933', color: '#f85149' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commandItems}
        onFileSearch={searchFiles}
        files={collectFiles(project.files)}
        onOpenFile={handleOpenFileFromSearch}
      />

      {/* Main Content - VS Code style layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        {showSidebar && (
          <FileExplorer
            projectId={project._id}
            files={project.files}
            activeFile={activeFile}
            onFileSelect={openFileInTab}
            onFilesChange={() => {
              setRefreshKey((k) => k + 1);
              fetchProject();
            }}
          />
        )}

        {/* Center Area: Editor on top, Terminal at bottom */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor + Right Panel Row */}
          <div className="flex-1 flex min-h-0">
            {/* Editor */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Editor Tabs */}
              <div className="flex items-center border-b overflow-x-auto shrink-0" style={{ background: tabInactiveBg, borderColor }}>
                {openTabs.length === 0 && (
                  <div className="px-4 py-2 text-sm opacity-50">No files open</div>
                )}
                {openTabs.map((tab) => {
                  const isActive = activeFile?.path === tab.file.path;
                  return (
                    <div
                      key={tab.file.path}
                      onClick={() => setActiveFile(tab.file)}
                      onMouseDown={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          closeTab(tab.file.path);
                        }
                      }}
                      className={`group flex items-center gap-1.5 px-3 py-2 text-sm border-r whitespace-nowrap cursor-pointer select-none transition-colors ${
                        isActive ? 'font-normal' : ''
                      }`}
                      style={{
                        background: isActive ? tabBg : 'transparent',
                        borderRightColor: borderColor,
                        color: isActive ? textColor : '#8b949e',
                      }}
                    >
                      <span className="text-xs">{getFileIcon(tab.file)}</span>
                      <span className="text-[13px]">{tab.file.name}</span>
                      <span className="relative">
                        {tab.isDirty ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ background: '#e5c07b' }}
                            title="Unsaved changes"
                          />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.file.path);
                            }}
                            className={`p-0.5 rounded-full hover:opacity-100 ${isActive ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
                            title="Close Tab (Ctrl+W)"
                            style={{ color: '#8b949e' }}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Breadcrumbs */}
              {showBreadcrumbs && activeFile && (
                <div className="flex items-center gap-0.5 px-4 py-1 border-b text-xs overflow-x-auto whitespace-nowrap shrink-0" style={{ background: tabBg, borderColor }}>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={crumb.path} className="flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          if (!crumb.isLast && project) {
                            const f = findFileByPath(project.files, crumb.path);
                            if (f) openFileInTab(f);
                          }
                        }}
                        className={`hover:text-blue-400 ${crumb.isLast ? 'opacity-90' : 'opacity-60'}`}
                      >
                        {crumb.name}
                      </button>
                      {!crumb.isLast && (
                        <span className="opacity-50">›</span>
                      )}
                    </span>
                  ))}
                  <div className="ml-auto flex items-center gap-3">
                    {errors.length > 0 && (
                      <button
                        onClick={() => {
                          editorRef.current?.trigger('errors', 'editor.action.marker.next', {});
                        }}
                        className="flex items-center gap-1 text-red-400 hover:text-red-300"
                        title={`${errors.length} errors in file`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {errors.length}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Search & Replace */}
              <SearchAndReplace
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                editorRef={editorRef}
                monacoRef={monacoRef}
              />

              {/* Monaco Editor */}
              <div className="flex-1 min-h-0 vscode-editor-container" style={{ background: bgColor }}>
                {activeFile && (
                  <Editor
                    key={refreshKey}
                    height="100%"
                    defaultLanguage={activeFile.language || 'javascript'}
                    language={activeFile.language || 'javascript'}
                    value={activeFile.content || ''}
                    theme={theme}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    options={editorOptions}
                    beforeMount={(monaco) => {
                      Object.entries(CUSTOM_THEMES).forEach(([name, themeData]) => {
                        monaco.editor.defineTheme(name, themeData as any);
                      });
                    }}
                  />
                )}
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between px-3 py-[1px] text-[11px] shrink-0 border-t select-none" style={{ background: '#007acc', color: 'white', borderColor: 'transparent' }}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {activeFile?.language || 'Plain Text'}
                  </span>
                  <span>
                    Ln {statistics.line}, Col {statistics.column}
                  </span>
                  <span>
                    {statistics.lineCount} lines
                  </span>
                  {statistics.selectedText && (
                    <span>
                      {statistics.selectedText.length} chars selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 1.096A4.001 4.001 0 003 15z" />
                    </svg>
                    UTF-8
                  </span>
                  <span>Spaces: 2</span>
                  <span>LF</span>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-80 border-l flex flex-col shrink-0" style={{ background: panelBg, borderColor }}>
              {/* Panel Tabs */}
              <div className="flex border-b shrink-0" style={{ borderColor }}>
                <button
                  onClick={() => setActivePanel('chat')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    activePanel === 'chat'
                      ? 'text-blue-400 border-blue-500'
                      : 'opacity-60 hover:opacity-100 border-transparent'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActivePanel('ai')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    activePanel === 'ai'
                      ? 'text-blue-400 border-blue-500'
                      : 'opacity-60 hover:opacity-100 border-transparent'
                  }`}
                >
                  AI Assistant
                </button>
                <button
                  onClick={() => setActivePanel('members')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    activePanel === 'members'
                      ? 'text-blue-400 border-blue-500'
                      : 'opacity-60 hover:opacity-100 border-transparent'
                  }`}
                >
                  Members
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {activePanel === 'chat' && (
                  <ChatPanel
                    projectId={project._id}
                    messages={chatMessages}
                    socket={socketRef.current}
                    currentUser={session?.user ?? null}
                  />
                )}
                {activePanel === 'ai' && (
                  <AIPanel
                    code={activeFile?.content || ''}
                    language={activeFile?.language || 'javascript'}
                    projectName={project.name}
                  />
                )}
                {activePanel === 'members' && (
                  <div className="p-4 space-y-3 overflow-y-auto h-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold mb-3">
                        Project Members ({project.members.length + 1})
                      </h3>
                      {isOwner && (
                        <button
                          onClick={handleClearChat}
                          className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                          style={{ background: '#f8514933', color: '#f85149' }}
                          title="Clear all chat messages"
                        >
                          Clear Chat
                        </button>
                      )}
                    </div>
                    {/* Owner */}
                    <div className="flex items-center justify-between rounded-lg p-3" style={{ background: '#4d4d4d33' }}>
                      {project.owner.image ? (
                        <img src={project.owner.image} alt={project.owner.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#007acc', color: 'white' }}>
                          {project.owner.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{project.owner.name}</p>
                        <p className="text-xs opacity-70" style={{ color: '#4da3ff' }}>Owner</p>
                      </div>
                      <span className="text-xs opacity-50">👑</span>
                    </div>
                    {/* Members */}
                    {project.members
                      .filter((m) => m._id !== project.owner._id)
                      .map((member) => (
                        <div key={member._id} className="flex items-center justify-between rounded-lg p-3" style={{ background: '#4d4d4d33' }}>
                          <div className="flex items-center gap-3">
                            {member.image ? (
                              <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#007acc', color: 'white' }}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{member.name}</p>
                              <p className="text-xs opacity-60">Member</p>
                            </div>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveMember(member._id)}
                              className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                              style={{ background: '#f8514933', color: '#f85149' }}
                              title={`Remove ${member.name}`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Terminal at bottom (VS Code style) */}
          {showTerminal && (
            <Terminal
              projectId={project._id}
              language={project.language}
              code={activeFile?.content || ''}
              fileName={activeFile?.name || ''}
              fileLanguage={activeFile?.language || ''}
            />
          )}
        </div>
      </div>
    </div>
  );
}