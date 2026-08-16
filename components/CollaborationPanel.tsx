'use client';

import { useEffect, useRef, useState } from 'react';

interface Collaborator {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  image?: string;
  connectedAt?: string;
  typing?: boolean;
  currentFile?: string | null;
  color?: string;
  socketId?: string;
}

interface CollaboratorPanelProps {
  onlineUsers: Collaborator[];
  projectMembers: Array<{ _id: string; name: string; email: string; image?: string }>;
  projectOwner: { _id: string; name: string; email: string; image?: string };
  currentUserId?: string;
  typingUsers: Record<string, { name: string; file?: string; color: string }>;
  isProjectOwner: boolean;
  onRemoveMember?: (memberId: string) => void;
}

// Helper to get initials
function getInitials(name: string): string {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

// Format connected time
function formatConnectedTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CollaborationPanel({
  onlineUsers,
  projectMembers,
  projectOwner,
  currentUserId,
  typingUsers,
  isProjectOwner,
  onRemoveMember,
}: CollaboratorPanelProps) {
  const [now, setNow] = useState(Date.now());

  // Update the "time ago" every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Merge owner + members into a full list
  const allMembers = [
    { ...projectOwner, role: 'Owner' as const, _id: projectOwner._id },
    ...projectMembers
      .filter((m) => m._id !== projectOwner._id)
      .map((m) => ({ ...m, role: 'Member' as const })),
  ];

  const onlineIds = new Set(onlineUsers.map((u) => u._id || u.id));

  // Count online collaborators (excluding self)
  const onlineCount = onlineUsers.filter((u) => (u._id || u.id) !== currentUserId).length;
  const totalCount = allMembers.length;

  // Which users are typing right now (excluding self)
  const activelyTyping = Object.entries(typingUsers)
    .filter(([id]) => id !== currentUserId)
    .map(([id, data]) => data);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b shrink-0" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
        <h3 className="text-sm font-semibold mb-1">Collaborators</h3>
        <p className="text-xs opacity-60">
          {onlineCount} of {totalCount} online
        </p>
      </div>

      {/* Live typing status */}
      {activelyTyping.length > 0 && (
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
          <div className="space-y-2">
            {activelyTyping.map((user, i) => (
              <div key={i} className="typing-pill flex items-center gap-2 text-xs" style={{ color: user.color || '#4da3ff' }}>
                <span style={{ color: user.color || '#4da3ff' }} className="font-medium">
                  {user.name}
                </span>
                {user.file && (
                  <span className="opacity-70 text-[10px] truncate max-w-[120px]">in {user.file}</span>
                )}
                <span className="flex items-center gap-0.5 ml-auto" style={{ color: user.color || '#4da3ff' }}>
                  <span className="typing-dot" style={{ background: 'currentColor', animationDelay: '0s' }} />
                  <span className="typing-dot" style={{ background: 'currentColor', animationDelay: '0.2s' }} />
                  <span className="typing-dot" style={{ background: 'currentColor', animationDelay: '0.4s' }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="p-4 space-y-2 flex-1">
        {allMembers.map((member) => {
          const isOnline = onlineIds.has(member._id);
          const onlineData = onlineUsers.find((u) => (u._id || u.id) === member._id);
          const isTyping = onlineData?.typing;
          const isCurrentUser = member._id === currentUserId;

          return (
            <div
              key={member._id}
              className={`collaborator-item flex items-center gap-3 rounded-lg p-2.5 ${
                isCurrentUser ? 'ring-1 ring-inset' : ''
              }`}
              style={{
                background: 'rgba(77,77,77,0.15)',
                ...(isCurrentUser ? { borderColor: 'rgba(77,154,255,0.3)', borderWidth: 1 } : {}),
              }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-8 h-8 rounded-full"
                    style={{ border: `2px solid ${onlineData?.color || '#4d4d4d'}` }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: onlineData?.color || '#4d4d4d',
                      border: `2px solid ${onlineData?.color || '#4d4d4d'}`,
                      color: '#fff',
                    }}
                  >
                    {getInitials(member.name)}
                  </div>
                )}
                {/* Online dot */}
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                    isOnline ? 'collaborator-online-dot' : ''
                  }`}
                  style={{
                    background: isOnline ? '#3fb950' : '#6b7280',
                    borderColor: '#252526',
                  }}
                  title={isOnline ? 'Online' : 'Offline'}
                />
              </div>

              {/* Name and status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {member.name}
                    {isCurrentUser && <span className="opacity-60 ml-1 text-[10px]">(you)</span>}
                  </p>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{
                      background: member.role === 'Owner' ? 'rgba(77,154,255,0.15)' : 'rgba(77,77,77,0.3)',
                      color: member.role === 'Owner' ? '#4da3ff' : 'inherit',
                      opacity: member.role === 'Member' ? 0.7 : 1,
                    }}
                  >
                    {member.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOnline ? (
                    <>
                      <span className="text-[10px]" style={{ color: onlineData?.color || '#3fb950' }}>
                        {isTyping ? (
                          <span className="flex items-center gap-0.5">
                            typing
                            <span className="typing-dot" style={{ background: 'currentColor', width: 3, height: 3 }} />
                            <span className="typing-dot" style={{ background: 'currentColor', width: 3, height: 3 }} />
                          </span>
                        ) : onlineData?.currentFile ? (
                          <span className="truncate max-w-[110px] inline-block">
                            📄 {onlineData.currentFile.split('/').pop()}
                          </span>
                        ) : (
                          'Online'
                        )}
                      </span>
                      {onlineData?.connectedAt && !isTyping && !onlineData?.currentFile && (
                        <span className="text-[9px] opacity-50">• {formatConnectedTime(onlineData.connectedAt)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] opacity-50">Offline</span>
                  )}
                </div>
              </div>
              {isProjectOwner && member.role === 'Member' && (
                <button
                  type="button"
                  onClick={() => onRemoveMember?.(member._id)}
                  className="shrink-0 p-1.5 rounded hover:bg-red-500/15 text-red-400"
                  title={`Remove ${member.name}`}
                  aria-label={`Remove ${member.name}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
