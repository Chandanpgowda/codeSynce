'use client';

import { useEffect, useState } from 'react';

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
  memberPermissions?: Record<string, 'editor' | 'viewer'>;
  onPermissionChange?: (memberId: string, permission: 'editor' | 'viewer') => void;
  projectDetails?: {
    name: string;
    description: string;
    language: string;
    tags: string[];
    isPublic: boolean;
  };
  onUpdateProjectDetails?: (updated: {
    name?: string;
    description?: string;
    language?: string;
    tags?: string[];
    isPublic?: boolean;
  }) => Promise<void>;
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
  memberPermissions = {},
  onPermissionChange,
  projectDetails,
  onUpdateProjectDetails,
}: CollaboratorPanelProps) {
  const [now, setNow] = useState(Date.now());
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState(projectDetails?.name || '');
  const [editDescription, setEditDescription] = useState(projectDetails?.description || '');
  const [editLanguage, setEditLanguage] = useState(projectDetails?.language || 'javascript');
  const [editTags, setEditTags] = useState(projectDetails?.tags?.join(', ') || '');
  const [editIsPublic, setEditIsPublic] = useState(projectDetails?.isPublic ?? true);
  const [savingDetails, setSavingDetails] = useState(false);

  // Update edit form when projectDetails changes
  useEffect(() => {
    if (projectDetails) {
      setEditName(projectDetails.name);
      setEditDescription(projectDetails.description);
      setEditLanguage(projectDetails.language);
      setEditTags(projectDetails.tags?.join(', ') || '');
      setEditIsPublic(projectDetails.isPublic);
    }
  }, [projectDetails]);

  // Update the "time ago" every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateProjectDetails) return;
    try {
      setSavingDetails(true);
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onUpdateProjectDetails({
        name: editName,
        description: editDescription,
        language: editLanguage,
        tags: tagsArray,
        isPublic: editIsPublic,
      });
      setIsEditingProject(false);
    } catch (err) {
      console.error('Failed to update project details:', err);
    } finally {
      setSavingDetails(false);
    }
  };

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
      <div className="p-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Collaborators</h3>
          <p className="text-xs opacity-60">
            {onlineCount} of {totalCount} online
          </p>
        </div>
        {isProjectOwner && onUpdateProjectDetails && (
          <button
            onClick={() => setIsEditingProject(!isEditingProject)}
            className="text-xs px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors flex items-center gap-1 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditingProject ? 'Cancel' : 'Edit Project'}
          </button>
        )}
      </div>

      {/* Edit Project Details Modal / Panel for Owner */}
      {isEditingProject && isProjectOwner && (
        <form onSubmit={handleSaveProjectDetails} className="p-4 border-b space-y-3 bg-white/[0.02]" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
          <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Project Details</h4>
          
          <div>
            <label className="block text-[11px] opacity-70 mb-1">Project Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] opacity-70 mb-1">Description</label>
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] opacity-70 mb-1">Primary Language</label>
              <select
                value={editLanguage}
                onChange={(e) => setEditLanguage(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] opacity-70 mb-1">Visibility</label>
              <select
                value={editIsPublic ? 'public' : 'private'}
                onChange={(e) => setEditIsPublic(e.target.value === 'public')}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] opacity-70 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="react, node, web"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditingProject(false)}
              className="px-3 py-1 text-xs opacity-70 hover:opacity-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDetails}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {savingDetails ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </form>
      )}

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
                <div className="shrink-0 flex items-center gap-1">
                  {onPermissionChange && (
                    <select
                      value={memberPermissions[member._id] || 'editor'}
                      onChange={(event) => onPermissionChange?.(member._id, event.target.value as 'editor' | 'viewer')}
                      className="bg-transparent border border-white/10 rounded px-1 py-1 text-[10px]"
                      aria-label={`${member.name} permission`}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveMember?.(member._id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                    title={`Remove ${member.name}`}
                    aria-label={`Remove ${member.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
