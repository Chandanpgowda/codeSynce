import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Project from '@/models/Project';
import type { UserRole } from '@/models/User';
import mongoose from 'mongoose';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

/**
 * Resolve the authenticated user from the database. This is the SIMPLE source
 * of truth for role checks — we never trust a role value sent by the client.
 * Returns null when unauthenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  await dbConnect();
  const user = (await User.findById(session.user.id)
    .select('name email role')
    .lean()) as any;

  if (!user) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: (user.role as UserRole) || 'builder',
  };
}

/** Ensure the user is authenticated, otherwise throw an HTTP-ish error payload. */
export async function requireUser() {
  const user = await getAuthUser();
  if (!user) {
    return { user: null as null, error: { error: 'Unauthorized', status: 401 } };
  }
  return { user, error: null };
}

/** Ensure the user is an EVALUATOR. */
export async function requireEvaluator() {
  const { user, error } = await requireUser();
  if (error || !user) return { user: null, error: error || { error: 'Unauthorized', status: 401 } };
  if (user.role !== 'evaluator') {
    return { user: null as null, error: { error: 'Forbidden: evaluator role required', status: 403 } };
  }
  return { user, error: null };
}

/** Ensure the user is a PROJECT BUILDER. */
export async function requireBuilder() {
  const { user, error } = await requireUser();
  if (error || !user) return { user: null, error: error || { error: 'Unauthorized', status: 401 } };
  if (user.role !== 'builder') {
    return { user: null as null, error: { error: 'Forbidden: builder role required', status: 403 } };
  }
  return { user, error: null };
}

/**
 * Check that the user has access to a project.
 * Access = owner, member, or (for read/public) public project. Evaluators gain
 * access only via an explicit assignment.
 */
export async function getUserProjectAccess(userId: string, projectId: string, mode: 'read' | 'write' = 'read') {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(projectId)) return { project: null, error: { error: 'Invalid project id', status: 400 } };

  const project = await Project.findById(projectId)
    .populate('owner', 'name email image')
    .populate('members', 'name email image')
    .populate('pendingRequests', 'name email image')
    .populate('lastEditedBy', 'name email image');

  if (!project) return { project: null, error: { error: 'Project not found', status: 404 } };

  const isOwner = project.owner._id.toString() === userId;
  const isMember = project.members.some(
    (m: any) => m._id.toString() === userId
  );

  if (mode === 'read' && project.isPublic) {
    return { project, error: null };
  }
  if (isOwner || isMember) {
    return { project, error: null };
  }

  return { project: null, error: { error: 'You do not have access to this project', status: 403 } };
}

export const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);