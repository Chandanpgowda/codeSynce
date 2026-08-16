'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  image?: string;
  phone?: string;
  skills: string[];
  bio?: string;
  provider: string;
  projectsOwned: string[];
  projectsJoined: string[];
  createdAt: string;
}

interface ProfileSettingsProps {
  onClose: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setName(data.user.name || '');
        setBio(data.user.bio || '');
        setSkills(data.user.skills?.join(', ') || '');
        setImage(data.user.image || '');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateImage = async () => {
    if (!image.trim()) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update image');
        return;
      }

      setSuccess('Profile image updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update image');
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-2xl max-h-[90vh] flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-dark-600">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-600">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'account'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Account
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Image */}
              <div className="flex items-center gap-4">
                {profile?.image ? (
                  <img
                    src={profile.image}
                    alt={profile.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {(profile?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-grow">
                  <h3 className="text-white font-semibold">{profile?.name}</h3>
                  <p className="text-sm text-gray-400">{profile?.email}</p>
                </div>
              </div>

              {/* Profile Image URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Profile Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="input-field"
                  />
                  <button
                    onClick={handleUpdateImage}
                    disabled={saving || !image.trim()}
                    className="btn-primary shrink-0"
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="input-field min-h-[100px] resize-y"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Skills (comma separated)</label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="JavaScript, React, Node.js, Python"
                  className="input-field"
                />
                {profile?.skills && profile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-1 bg-primary-600/20 text-primary-400 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Account Info */}
              <div className="card">
                <h3 className="text-white font-semibold mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Email</span>
                    <span className="text-white text-sm">{profile?.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Phone</span>
                    <span className="text-white text-sm">{profile?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Provider</span>
                    <span className="text-white text-sm capitalize">{profile?.provider || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Member since</span>
                    <span className="text-white text-sm">
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Projects Owned</span>
                    <span className="text-white text-sm">{profile?.projectsOwned?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Projects Joined</span>
                    <span className="text-white text-sm">{profile?.projectsJoined?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <div className="card">
                <h3 className="text-white font-semibold mb-4">Session</h3>
                <button
                  onClick={() => {
                    if (confirm('Sign out from this session?')) signOut({ callbackUrl: '/' });
                  }}
                  className="btn-secondary w-full"
                >
                  Sign Out
                </button>
              </div>

              {/* Delete Account */}
              <div className="card border-red-500/30">
                <h3 className="text-red-400 font-semibold mb-2">Danger Zone</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                {showDeleteConfirm ? (
                  <div className="space-y-3">
                    <p className="text-yellow-400 text-sm">
                      Are you sure? This will permanently delete your account and all associated data.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/profile', { method: 'DELETE' });
                            signOut({ callbackUrl: '/' });
                          } catch (err) {
                            console.error('Failed to delete account:', err);
                          }
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Delete My Account
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold py-2 px-4 rounded-lg transition-colors border border-red-500/30"
                  >
                    Delete Account
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
