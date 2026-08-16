'use client';

import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface Mentions {
  users: Array<{ _id: string; name: string; image?: string }>;
  mentionedIn: string;
}

export interface ChatMessage {
  user: {
    _id: string;
    name: string;
    image?: string;
  };
  message: string;
  timestamp: string;
  replyTo?: {
    user: {
      name: string;
    };
    message: string;
  };
  codeSnippet?: {
    language: string;
    code: string;
  };
  mentions: string[];
  fileReference?: {
    projectId: string;
    filePath: string;
    lineNumber: number;
  };
}

interface ChatPanelProps {
  projectId: string;
  messages: ChatMessage[];
  socket: Socket | null;
  currentUser: {
    id?: string;
    name?: string | null;
    image?: string | null;
  } | null;
  onSendMessage?: (message: ChatMessage) => void;
}

function parseMarkdown(text: string): string {
  // Basic markdown parsing - convert # headings, **bold**, *italic*, `code`, and links
  if (!text) return '';

  // Convert code blocks (``` ... ```)
  let result = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre className="bg-dark-800 p-3 rounded-md text-sm overflow-x-auto"><code className="text-primary-400">${code.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")}</code></pre>`;
  });

  // Convert inline code (`text`)
  result = result.replace(/`([^`]+)`/g, (match, code) => {
    return `<code className="bg-dark-700 px-1 py-0.5 rounded text-sm">${code}</code>`;
  });

  // Convert **bold**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* (but not **)
  result = result.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // Convert # headings
  result = result.replace(/^# (.+)$/gm, '<h4 className="text-xl font-bold text-white mb-2">$1</h4>');

  // Convert links [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" className="text-primary-400 underline" rel="noopener noreferrer">$1</a>');

  // Convert @mentions
  result = result.replace(/@(\w+)/g, (match, username) => {
    return `<span className="relative inline-flex items-center text-xs font-medium text-primary-600 hover:underline" title="@${username}">
      @${username}
      <span className="absolute -bottom-1 -right-0.5 w-3 h-3 rounded-full bg-primary-600 text-xs text-white">
        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7a6 6 0 016 6z" />
        </span>
      </span>`;
  });

  // Convert newlines to br
  result = result.replace(/\n/g, '<br />');

  return result;
}

export default function ChatPanel({ projectId, messages, socket, currentUser, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const trimmedMessage = input.trim();

    // Optimistic update - show message immediately on sender's screen
    onSendMessage?.({
      user: {
        _id: currentUser?.id || '',
        name: currentUser?.name || 'Unknown',
        image: currentUser?.image || undefined,
      },
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
      mentions: [],
    });

    // Emit to server for broadcast to other users
    if (socket) {
      socket.emit('send-message', {
        projectId,
        message: trimmedMessage,
        user: {
          _id: currentUser?.id,
          id: currentUser?.id,
          name: currentUser?.name,
          image: currentUser?.image,
        },
      });
    }

    setInput('');
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getUserColor = (userId: string) => {
    const colors = [
      '#f94144', '#f3722c', '#f8961e', '#f9c74f',
      '#90be6d', '#43aa8b', '#4d908e', '#577590',
      '#277da1', '#e63946', '#f4a261', '#2a9d8f',
      '#e76f51', '#8ecae6', '#ffb703', '#fb8500',
      '#06d6a0', '#118ab2', '#ef476f', '#8338ec',
      '#3a86ff', '#ff006e', '#7b2cbf', '#00bbf9',
    ];
    let hash = 0;
    const str = String(userId || '');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string): string => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isOwn = msg.user?._id === currentUser?.id;
          const mentionedUsers = msg.mentions || [];
          
          return (
            <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isOwn ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {!isOwn && (
                    <span className="text-xs font-medium text-gray-400">
                      {msg.user?.name || 'Unknown'}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    isOwn
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-dark-700 text-gray-200 rounded-bl-none'
                  }`}
                >
                  {msg.replyTo && !isOwn && (
                    <div className="mb-2 p-2 bg-primary-600/10 rounded border border-primary-600/20">
                      <div className="text-xs text-primary-400 mb-1">
                        Replying to {msg.replyTo.user?.name}: 
                        <span className="font-medium text-primary-400">{msg.replyTo.message}</span>
                      </div>
                    </div>
                  )}
                  <div
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.message) }}
                  />
                  {msg.codeSnippet && (
                    <div className="mt-2 bg-dark-800 p-3 rounded-md text-sm overflow-x-auto">
                      <pre>
                        <code className="text-primary-400">
                          {msg.codeSnippet.code}
                        </code>
                      </pre>
                    </div>
                  )}
                  {msg.mentions && msg.mentions.length > 0 && (
                    <div className="mt-2 text-xs">
                      {msg.mentions.map((mention, i) => (
                        <span key={i} className="relative inline-flex items-center text-primary-600 hover:underline">
                          @{mention}
                          <span className="absolute -bottom-1 -right-0.5 w-3 h-3 rounded-full bg-primary-600 text-xs text-white">
                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7a6 6 0 016 6z" />
                            </svg>
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.fileReference && (() => {
                    const fileRef = msg.fileReference;
                    return (
                      <div className="mt-2">
                        <div className="text-xs text-primary-500 cursor-pointer hover:underline" 
                          onClick={() => {
                            // Navigate to the file/line
                            window.location.href = `/editor/${fileRef.projectId}`;
                          }}
                        >
                          📄 Jump to {fileRef.filePath.split('/').pop()} (line {fileRef.lineNumber})
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-dark-600">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="input-field text-sm flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}