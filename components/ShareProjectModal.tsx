'use client';

import { useState } from 'react';

interface ShareProjectModalProps {
  projectId: string;
  projectName: string;
  isPublic: boolean;
  onClose: () => void;
  onVisibilityChange: (isPublic: boolean) => void;
}

export default function ShareProjectModal({ projectId, projectName, isPublic, onClose, onVisibilityChange }: ShareProjectModalProps) {
  const [visibility, setVisibility] = useState(isPublic);
  const [inviteLink, setInviteLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const publicLink = typeof window === 'undefined' ? '' : `${window.location.origin}/editor/${projectId}`;

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  };

  const updateVisibility = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update visibility');
      onVisibilityChange(data.project.isPublic);
      setNotice(visibility ? 'Project is now discoverable.' : 'Project is now private.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to update visibility');
    } finally {
      setSaving(false);
    }
  };

  const createInvite = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invite');
      const link = `${window.location.origin}/invite?project=${projectId}&token=${data.token}`;
      setInviteLink(link);
      await copy(link, 'Secure invite link copied. It expires in seven days.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create invite');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const url = inviteLink || (visibility ? publicLink : '');
    if (!url) return setNotice('Create a secure invite link before sharing this private project.');
    if (navigator.share) {
      await navigator.share({ title: projectName, text: `Join ${projectName} on CodeSync`, url });
    } else {
      await copy(url, 'Link copied to clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="share-project-title" className="w-full max-w-md rounded-md border border-dark-600 bg-dark-800 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div><h2 id="share-project-title" className="text-base font-semibold text-white">Share Project</h2><p className="text-xs text-gray-400 mt-1">{projectName}</p></div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Close share project">X</button>
        </div>

        <div className="mt-5 rounded border border-white/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium text-white">Public discovery</p><p className="text-xs text-gray-400 mt-1">Visitors can open the link and request access.</p></div>
            <button type="button" onClick={() => setVisibility((value) => !value)} className={`relative h-5 w-10 rounded-full ${visibility ? 'bg-primary-600' : 'bg-gray-600'}`} aria-label="Toggle public project"><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${visibility ? 'translate-x-5' : 'translate-x-1'}`} /></button>
          </div>
          {visibility !== isPublic && <button type="button" onClick={updateVisibility} disabled={saving} className="mt-3 px-2 py-1 text-xs rounded bg-primary-600 hover:bg-primary-700 disabled:opacity-50">Save visibility</button>}
          {visibility && <div className="flex gap-2 mt-3"><input readOnly value={publicLink} className="input-field text-xs flex-1" /><button type="button" onClick={() => copy(publicLink, 'Public link copied.')} className="px-2 text-xs rounded hover:bg-white/10">Copy</button></div>}
        </div>

        <div className="mt-3 rounded border border-white/10 p-3">
          <p className="text-sm font-medium text-white">Secure invite</p><p className="text-xs text-gray-400 mt-1">Direct access link for collaborators. Each new link replaces the previous one and expires after seven days.</p>
          <div className="flex gap-2 mt-3"><button type="button" onClick={createInvite} disabled={saving} className="px-2 py-1 text-xs rounded bg-primary-600 hover:bg-primary-700 disabled:opacity-50">Create invite</button><button type="button" onClick={share} disabled={saving} className="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/10 disabled:opacity-50">Share</button></div>
          {inviteLink && <div className="flex gap-2 mt-3"><input readOnly value={inviteLink} className="input-field text-xs flex-1" /><button type="button" onClick={() => copy(inviteLink, 'Secure invite link copied.')} className="px-2 text-xs rounded hover:bg-white/10">Copy</button></div>}
        </div>
        {notice && <p className="mt-3 text-xs text-primary-300" role="status">{notice}</p>}
      </section>
    </div>
  );
}
