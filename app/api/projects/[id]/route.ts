import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';

// Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await Project.findById(params.id)
      .populate('owner', 'name email image')
      .populate('members', 'name email image')
      .populate('pendingRequests', 'name email image')
      .populate('chatMessages.user', 'name email image');

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update project details OR clear chat (owner only)
// PUT /api/projects/[id]?clearChat=true -> clear chat messages
// PUT /api/projects/[id] -> update project
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clearChat = searchParams.get('clearChat') === 'true';

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Only the owner can update this project' }, { status: 403 });
    }

    if (clearChat) {
      project.chatMessages = [];
      await project.save();
      return NextResponse.json({ success: true, message: 'Chat cleared' });
    }

    const body = await request.json();
    const { name, description, language, tags, isPublic } = body;

    if (name) project.name = name;
    if (description) project.description = description;
    if (language) project.language = language;
    if (tags) project.tags = tags;
    if (typeof isPublic === 'boolean') project.isPublic = isPublic;

    await project.save();

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete project OR remove a member (owner only)
// DELETE /api/projects/[id]?userId=USER_ID -> remove member
// DELETE /api/projects/[id] -> delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (userId) {
      // Remove member from project
      if (project.owner.toString() !== session.user.id) {
        return NextResponse.json({ error: 'Only project owner can remove members' }, { status: 403 });
      }

      if (userId === project.owner.toString()) {
        return NextResponse.json({ error: 'Cannot remove the project owner' }, { status: 400 });
      }

      project.members = project.members.filter(
        (member: import('mongoose').Types.ObjectId) => member.toString() !== userId
      );
      await project.save();

      // Remove project from user's projectsJoined
      await User.findByIdAndUpdate(userId, {
        $pull: { projectsJoined: project._id },
      });

      // Notify the removed user
      await Notification.create({
        user: userId,
        type: 'member_removed',
        message: `You were removed from "${project.name}"`,
        projectId: project._id,
        fromUser: session.user.id,
      });

      // Return populated project so frontend can refresh
      const updatedProject = await Project.findById(params.id)
        .populate('owner', 'name email image')
        .populate('members', 'name email image')
        .populate('pendingRequests', 'name email image');

      return NextResponse.json({ success: true, message: 'Member removed', project: updatedProject });
    }

    // Delete project
    if (project.owner.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Only the owner can delete this project' }, { status: 403 });
    }

    // Remove project from users
    await User.updateMany(
      { $or: [{ projectsOwned: project._id }, { projectsJoined: project._id }] },
      { $pull: { projectsOwned: project._id, projectsJoined: project._id } }
    );

    await project.deleteOne();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Project action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}