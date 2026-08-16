'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CreateProjectModal from '@/components/CreateProjectModal';
import NotificationBell from '@/components/NotificationBell';
import ProfileSettings from '@/components/ProfileSettings';

interface User {
  _id: string;
  name: string;
  email: string;
  image?: string;
}

interface Project {
  _id: string;
  name: string;
  description: string;
  owner: User;
  members: User[];
  pendingRequests: User[];
  language: string;
  tags: string[];
  isPublic: boolean;
  lastEditedAt: string;
  lastEditedBy?: User;
  createdAt: string;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  image?: string;
  skills: string[];
  bio?: string;
  projectsOwned: string[];
  projectsJoined: string[];
}

const LANG_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/20 text-yellow-400',
  typescript: 'bg-blue-500/20 text-blue-400',
  python: 'bg-green-500/20 text-green-400',
  java: 'bg-orange-500/20 text-orange-400',
  c: 'bg-gray-500/20 text-gray-400',
  cpp: 'bg-pink-500/20 text-pink-400',
  csharp: 'bg-purple-500/20 text-purple-400',
  go: 'bg-cyan-500/20 text-cyan-400',
  rust: 'bg-orange-600/20 text-orange-300',
  ruby: 'bg-red-500/20 text-red-400',
  php: 'bg-indigo-500/20 text-indigo-400',
  html: 'bg-orange-400/20 text-orange-300',
  css: 'bg-blue-400/20 text-blue-300',
  json: 'bg-yellow-400/20 text-yellow-300',
  sql: 'bg-emerald-500/20 text-emerald-400',
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [collaboratingProjects, setCollaboratingProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'mine' | 'collaborating'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsRes, profileRes] = await Promise.all([
        fetch(`/api/projects?search=${encodeURIComponent(search)}`),
        fetch('/api/profile'),
      ]);

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects);
        
        if (session?.user?.id) {
          const userId = session.user.id;
          setMyProjects(
            data.projects.filter((p: Project) => p.owner._id === userId)
          );
          setCollaboratingProjects(
            data.projects.filter(
              (p: Project) =>
                p.owner._id !== userId &&
                p.members.some((m: User) => m._id === userId)
            )
          );
        }
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.user);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, [search, session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, fetchProjects]);

  const handleJoinRequest = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/join`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        alert('Join request sent! The project owner will review your request.');
        fetchProjects();
      } else {
        alert(data.error || 'Failed to send join request');
      }
    } catch (error) {
      alert('Failed to send join request');
    }
  };

  const handleCancelJoinRequest = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/join`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to cancel join request:', error);
    }
  };

  const handleRequestAction = async (projectId: string, userId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to handle request:', error);
    }
  };

  const formatLastEdited = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitial = (name: string) => (name || 'U').charAt(0).toUpperCase();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const visibleProjects =
    activeView === 'mine'
      ? myProjects
      : activeView === 'collaborating'
        ? collaboratingProjects
        : projects;

  const projectCount = myProjects.length + collaboratingProjects.length;

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0d1117]"></div>
              </div>
              <div>
                <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Code<span className="text-primary-400">Synce</span>
                </span>
                <p className="text-[10px] text-gray-500 -mt-0.5">Collaborative Coding</p>
              </div>
            </div>

            {/* Search bar (hidden on small screens, shown in center) */}
            <div className="hidden lg:block flex-1 max-w-xl mx-8 relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name, description, or tags..."
                className="w-full bg-[#161b22] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-px"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Project
              </button>

              {/* Notifications */}
              {session?.user?.id && <NotificationBell userId={session.user.id} />}

              {/* Profile / Settings */}
              <div className="relative ml-1">
                <button
                  onClick={() => setShowProfileSettings(true)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-primary-500/50 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/10 group-hover:ring-primary-500/50 transition-all">
                      {getInitial(session?.user?.name || 'U')}
                    </div>
                  )}
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <div className="lg:hidden pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-[#161b22] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
                {session?.user?.name?.split(' ')[0] || 'Developer'}
              </span>
            </h1>
            <p className="text-gray-400 mt-1 text-sm md:text-base">
              {profile?.skills && profile.skills.length > 0 ? (
                <>
                  <span className="text-gray-500">{profile.skills.slice(0, 3).join(' · ')}</span>
                  {profile.skills.length > 3 && (
                    <span className="text-gray-600"> · +{profile.skills.length - 3} more</span>
                  )}
                </>
              ) : (
                'Here\'s what\'s happening across your projects'
              )}
            </p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4">
            <div className="bg-[#161b22] border border-white/5 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-bold text-primary-400">{myProjects.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Owned</p>
            </div>
            <div className="bg-[#161b22] border border-white/5 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-bold text-cyan-400">{collaboratingProjects.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Collab</p>
            </div>
            <div className="hidden sm:block bg-[#161b22] border border-white/5 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-bold text-green-400">{projectCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total</p>
            </div>
          </div>
        </div>

        {/* Create Project Mobile Button */}
        <div className="sm:hidden mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-500/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Project
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#161b22] border border-white/5 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveView('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'all'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Projects
          </button>
          <button
            onClick={() => setActiveView('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'mine'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            My Projects
            {myProjects.length > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeView === 'mine' ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {myProjects.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('collaborating')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'collaborating'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Collaborating
            {collaboratingProjects.length > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeView === 'collaborating' ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {collaboratingProjects.length}
              </span>
            )}
          </button>
        </div>

        {/* Projects Section */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : visibleProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleProjects.map((project) => {
              const isOwner = project.owner._id === session?.user?.id;
              const isMember = project.members.some((m: User) => m._id === session?.user?.id);
              const isPending = project.pendingRequests.some(
                (req: User) => req._id === session?.user?.id
              );

              return (
                <div
                  key={project._id}
                  className="bg-[#161b22] border border-white/5 rounded-xl overflow-hidden hover:border-primary-500/30 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 group"
                >
                  {/* Card Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {project.owner.image ? (
                          <img
                            src={project.owner.image}
                            alt={project.owner.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center font-bold text-white shrink-0">
                            {getInitial(project.owner.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/editor/${project._id}`}
                            className="font-semibold text-white hover:text-primary-400 transition-colors truncate block group-hover:text-primary-300"
                          >
                            {project.name}
                          </Link>
                          <p className="text-xs text-gray-500 truncate">
                            by {project.owner.name}
                            {isOwner && <span className="text-primary-400 ml-1">(Owner)</span>}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ${LANG_COLORS[project.language] || 'bg-gray-500/20 text-gray-400'}`}>
                        {project.language}
                      </span>
                    </div>

                    <p className="text-sm text-gray-400 line-clamp-2 mb-4 min-h-[40px]">
                      {project.description}
                    </p>

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {project.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 bg-primary-600/10 text-primary-400 rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="text-[11px] px-2 py-0.5 bg-white/5 text-gray-500 rounded-full">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Team members */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="flex -space-x-2">
                          {project.members.slice(0, 4).map((member) => (
                            <div key={member._id} className="relative">
                              {member.image ? (
                                <img
                                  src={member.image}
                                  alt={member.name}
                                  title={member.name}
                                  className="w-7 h-7 rounded-full object-cover border-2 border-[#161b22]"
                                />
                              ) : (
                                <div
                                  title={member.name}
                                  className="w-7 h-7 rounded-full border-2 border-[#161b22] bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[10px] font-bold text-white"
                                >
                                  {getInitial(member.name)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {project.members.length > 4 && (
                          <span className="ml-2 text-xs text-gray-500">
                            +{project.members.length - 4}
                          </span>
                        )}
                      </div>

                      {/* Pending requests (owner) */}
                      {isOwner && project.pendingRequests.length > 0 && (
                        <div className="relative group/req">
                          <button
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {project.pendingRequests.length} pending
                          </button>
                          {/* Request dropdown */}
                          <div className="hidden group-hover/req:block absolute right-0 top-full mt-2 w-72 bg-[#1c2128] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                            <div className="px-4 py-2 bg-white/5 text-xs font-semibold text-gray-300">
                              Join Requests
                            </div>
                            {project.pendingRequests.map((requester: User) => (
                              <div key={requester._id} className="px-4 py-2.5 flex items-center justify-between border-t border-white/5">
                                <div className="flex items-center gap-2 truncate flex-1 mr-2">
                                  {requester.image ? (
                                    <img
                                      src={requester.image}
                                      alt={requester.name}
                                      className="w-6 h-6 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                      {getInitial(requester.name)}
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-300 truncate">
                                    {requester.name}
                                  </span>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => handleRequestAction(project._id, requester._id, 'accept')}
                                    className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleRequestAction(project._id, requester._id, 'reject')}
                                    className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Last edited info */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          {formatLastEdited(project.lastEditedAt)}
                          {project.lastEditedBy?.name && (
                            <span className="text-gray-600">
                              {' '}by {project.lastEditedBy.name.split(' ')[0]}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-gray-600">
                        {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-center gap-2">
                    {isOwner || isMember ? (
                      <Link
                        href={`/editor/${project._id}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-primary-500/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Open Editor
                      </Link>
                    ) : isPending ? (
                      <button
                        onClick={() => handleCancelJoinRequest(project._id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm font-medium py-2 rounded-lg transition-colors border border-yellow-500/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pending... Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinRequest(project._id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-primary-600/20 text-gray-300 hover:text-white text-sm font-medium py-2 rounded-lg transition-all border border-white/10 hover:border-primary-500/40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Join Project
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#161b22] border border-white/5 rounded-2xl py-20 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">
              {activeView === 'mine'
                ? 'No projects owned yet'
                : activeView === 'collaborating'
                  ? 'Not collaborating on any projects'
                  : search
                    ? `No projects found for "${search}"`
                    : 'No projects yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {activeView === 'mine'
                ? 'Create your first project and start coding collaboratively'
                : activeView === 'collaborating'
                  ? 'Join projects to collaborate with other developers'
                  : search
                    ? 'Try a different search term or explore all projects'
                    : 'Get started by creating your first project'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                + Create Project
              </button>
              {(activeView === 'mine' || (search && activeView === 'all')) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setActiveView('all');
                  }}
                  className="btn-secondary"
                >
                  View All Projects
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}

      {showProfileSettings && (
        <ProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
    </div>
  );
}