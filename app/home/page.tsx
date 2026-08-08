'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CreateProjectModal from '@/components/CreateProjectModal';

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
  members: string[];
  pendingRequests: string[];
  language: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'mine'>('explore');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, search]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects?search=${search}`);
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects);
        // Filter my projects
        if (session?.user?.id) {
          const mine = data.projects.filter(
            (p: Project) =>
              p.owner._id === session.user.id ||
              p.members.includes(session.user.id)
          );
          setMyProjects(mine);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-dark-600 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Code<span className="text-primary-500">Synce</span></span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                + Create Project
              </button>
              <div className="flex items-center gap-3">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {(session?.user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'explore'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            Explore Projects
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'mine'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            My Projects
          </button>
        </div>

        {/* Search */}
        {activeTab === 'explore' && (
          <div className="mb-8">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name or description..."
              className="input-field max-w-xl"
            />
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeTab === 'explore' ? projects : myProjects).map((project) => (
              <div key={project._id} className="card hover:border-primary-600 transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {project.owner.image ? (
                      <img
                        src={project.owner.image}
                        alt={project.owner.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center font-bold">
                        {project.owner.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{project.name}</h3>
                      <p className="text-xs text-gray-500">by {project.owner.name}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-dark-700 rounded-full text-gray-400">
                    {project.language}
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-4 flex-grow line-clamp-3">
                  {project.description}
                </p>

                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-primary-600/20 text-primary-400 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-gray-500">
                    {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                  </span>
                  {project.owner._id === session?.user?.id ? (
                    <Link
                      href={`/editor/${project._id}`}
                      className="btn-primary text-sm"
                    >
                      Open Editor
                    </Link>
                  ) : project.members.includes(session?.user?.id || '') ? (
                    <Link
                      href={`/editor/${project._id}`}
                      className="btn-primary text-sm"
                    >
                      Open Editor
                    </Link>
                  ) : project.pendingRequests.includes(session?.user?.id || '') ? (
                    <span className="text-sm text-yellow-500 font-medium">
                      Request Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinRequest(project._id)}
                      className="btn-secondary text-sm"
                    >
                      Request to Join
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!loading && (activeTab === 'explore' ? projects : myProjects).length === 0 && (
              <div className="col-span-full text-center py-20">
                <p className="text-gray-400 text-lg mb-4">
                  {activeTab === 'explore'
                    ? 'No projects found. Be the first to create one!'
                    : 'You haven\'t joined any projects yet.'}
                </p>
                {activeTab === 'explore' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    Create Your First Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}
    </main>
  );
}