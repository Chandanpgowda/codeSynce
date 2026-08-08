'use client';

import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface ChatMessage {
  user: {
    _id: string;
    name: string;
    image?: string;
  };
  message: string;
  timestamp: string;
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
}

export default function ChatPanel({ projectId, messages, socket, currentUser }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('send-message', {
      projectId,
      message: input.trim(),
      user: {
        _id: currentUser?.id,
        name: currentUser?.name,
        image: currentUser?.image,
      },
    });

    setInput('');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          const isOwn = msg.user._id === currentUser?.id;
          return (
            <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isOwn ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {!isOwn && (
                    <span className="text-xs font-medium text-gray-400">
                      {msg.user.name}
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
                  {msg.message}
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
            className="input-field text-sm"
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