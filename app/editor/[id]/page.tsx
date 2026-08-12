'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import ChatPanel from '@/components/ChatPanel';
import AIPanel from '@/components/AIPanel';
import FileExplorer from '@/components/FileExplorer';
import Terminal from '@/components/Terminal';

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

export const dynamic = 'force-dynamic';

export default function EditorPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [activePanel, setActivePanel] = useState<'chat' | 'ai' | 'members'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isRemoteUpdateRef = useRef(false);

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

      setProject(data.project);
      setActiveFile(findFirstFile(data.project.files) || null);

      const userId = session?.user?.id;
      setIsOwner(data.project.owner._id === userId);
      setIsMember(
        data.project.members.some((m: any) => m._id === userId) ||
        data.project.owner._id === userId
      );

      // Load chat messages
      if (data.project.chatMessages) {
        setChatMessages(data.project.chatMessages);
      }
    } catch (err) {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Setup socket connection
  useEffect(() => {
    if (!project || !isMember) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
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

    // Track cursor position
    editor.onDidChangeCursorPosition((e: any) => {
      socketRef.current?.emit('cursor-update', {
        projectId: project?._id,
        position: e.position,
        user: {
          _id: session?.user?.id,
          name: session?.user?.name,
        },
      });
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !project || !activeFile) return;
    if (isRemoteUpdateRef.current) return;

    // Update local state so code is available for Run Code feature
    setActiveFile((prev) => (prev ? { ...prev, content: value } : null));

    // Broadcast file change to other users
    socketRef.current?.emit('file-change', {
      projectId: project._id,
      file: activeFile.path,
      content: value,
    });
  };

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

  return (
    <div className="h-screen flex flex-col bg-dark-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 h-12 bg-dark-800 border-b border-dark-600 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/home')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="font-semibold text-white">{project.name}</span>
          </div>
          <span className="text-xs px-2 py-1 bg-dark-700 rounded-full text-gray-400">
            {project.language}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Online users */}
          <div className="flex -space-x-2">
            {onlineUsers.slice(0, 5).map((user, i) => (
              <div
                key={i}
                title={user.name}
                className="w-7 h-7 rounded-full border-2 border-dark-800 bg-primary-600 flex items-center justify-center text-xs font-bold text-white"
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div className="w-7 h-7 rounded-full border-2 border-dark-800 bg-dark-600 flex items-center justify-center text-xs text-white">
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>

          {/* Join requests (owner only) */}
          {isOwner && project.pendingRequests.length > 0 && (
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="relative px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors"
            >
              {project.pendingRequests.length} Request{project.pendingRequests.length > 1 ? 's' : ''}
            </button>
          )}

          <div className="flex items-center gap-2">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                {(session?.user?.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-400 hidden sm:block">
              {session?.user?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Join Requests Panel */}
      {showRequests && isOwner && (
        <div className="bg-dark-800 border-b border-dark-600 p-4 shrink-0">
          <h3 className="text-sm font-semibold text-white mb-3">Join Requests</h3>
          <div className="space-y-2">
            {project.pendingRequests.map((user) => (
              <div key={user._id} className="flex items-center justify-between bg-dark-700 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptRequest(user._id)}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectRequest(user._id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content - VS Code style layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <FileExplorer
          projectId={project._id}
          files={project.files}
          activeFile={activeFile}
          onFileSelect={setActiveFile}
          onFilesChange={() => {
            setRefreshKey((k) => k + 1);
            fetchProject();
          }}
        />

        {/* Center Area: Editor on top, Terminal at bottom */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor + Right Panel Row */}
          <div className="flex-1 flex min-h-0">
            {/* Editor */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Editor Tabs */}
              <div className="flex items-center bg-dark-800 border-b border-dark-600 overflow-x-auto shrink-0">
                {collectFiles(project.files).map((file) => (
                  <button
                    key={file.path}
                    onClick={() => setActiveFile(file)}
                    className={`px-4 py-2 text-sm border-r border-dark-600 whitespace-nowrap transition-colors ${
                      activeFile?.path === file.path
                        ? 'bg-dark-900 text-white border-t-2 border-t-primary-600'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {file.name}
                  </button>
                ))}
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 min-h-0">
                {activeFile && (
                  <Editor
                    key={refreshKey}
                    height="100%"
                    defaultLanguage={activeFile.language || 'javascript'}
                    language={activeFile.language || 'javascript'}
                    value={activeFile.content || ''}
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      folding: true,
                      bracketPairColorization: { enabled: true },
                      renderWhitespace: 'selection',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      smoothScrolling: true,
                      padding: { top: 10, bottom: 10 },
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-80 bg-dark-800 border-l border-dark-600 flex flex-col shrink-0">
              {/* Panel Tabs */}
              <div className="flex border-b border-dark-600 shrink-0">
                <button
                  onClick={() => setActivePanel('chat')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activePanel === 'chat'
                      ? 'text-primary-500 border-b-2 border-primary-600'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActivePanel('ai')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activePanel === 'ai'
                      ? 'text-primary-500 border-b-2 border-primary-600'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  AI Assistant
                </button>
                <button
                  onClick={() => setActivePanel('members')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activePanel === 'members'
                      ? 'text-primary-500 border-b-2 border-primary-600'
                      : 'text-gray-400 hover:text-white'
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
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Project Members ({project.members.length + 1})
                    </h3>
                    {/* Owner */}
                    <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3">
                      {project.owner.image ? (
                        <img src={project.owner.image} alt={project.owner.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {project.owner.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{project.owner.name}</p>
                        <p className="text-xs text-primary-500">Owner</p>
                      </div>
                    </div>
                    {/* Members */}
                    {project.members
                      .filter((m) => m._id !== project.owner._id)
                      .map((member) => (
                        <div key={member._id} className="flex items-center gap-3 bg-dark-700 rounded-lg p-3">
                          {member.image ? (
                            <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{member.name}</p>
                            <p className="text-xs text-gray-500">Member</p>
                          </div>
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