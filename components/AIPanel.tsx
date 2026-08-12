'use client';

import { useState, useRef, useEffect } from 'react';

interface AIPanelProps {
  code: string;
  language: string;
  projectName: string;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: 'gemini';
}

export default function AIPanel({ code, language, projectName }: AIPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          code,
          language,
          context: projectName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response, provider: 'gemini' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Failed to get AI response' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to connect to AI assistant' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <div className="w-12 h-12 bg-primary-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="font-medium text-gray-400 mb-1">AI Assistant</p>
            <p className="text-xs">Ask me anything about your code!</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-none'
                  : 'bg-dark-700 text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant' && msg.provider && (
                <div className="mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-400">
                    Google Gemini
                  </span>
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-700 text-gray-200 px-3 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickPrompt('Explain this code')}
            className="text-xs px-3 py-1.5 bg-dark-700 text-gray-300 rounded-full hover:bg-dark-600 transition-colors"
          >
            Explain code
          </button>
          <button
            onClick={() => handleQuickPrompt('Find and fix bugs in this code')}
            className="text-xs px-3 py-1.5 bg-dark-700 text-gray-300 rounded-full hover:bg-dark-600 transition-colors"
          >
            Find bugs
          </button>
          <button
            onClick={() => handleQuickPrompt('Optimize this code for performance')}
            className="text-xs px-3 py-1.5 bg-dark-700 text-gray-300 rounded-full hover:bg-dark-600 transition-colors"
          >
            Optimize
          </button>
          <button
            onClick={() => handleQuickPrompt('Add comments to this code')}
            className="text-xs px-3 py-1.5 bg-dark-700 text-gray-300 rounded-full hover:bg-dark-600 transition-colors"
          >
            Add comments
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-dark-600">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI about your code..."
            className="input-field text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
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