import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// List all projects
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';

    const query: any = { isPublic: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) {
      query.tags = tag;
    }

    const projects = await Project.find(query)
      .populate('owner', 'name email image')
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new project
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, language, tags, isPublic } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Project name and description are required' },
        { status: 400 }
      );
    }

    const initialFileName = language === 'python' ? 'main.py' : 'index.js';
    const project = await Project.create({
      name,
      description,
      owner: session.user.id,
      members: [session.user.id],
      language: language || 'javascript',
      tags: tags || [],
      isPublic: isPublic ?? true,
      files: [
        {
          name: initialFileName,
          path: initialFileName,
          content: '',
          language: language || 'javascript',
          type: 'file',
        },
      ],
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Remove a member from the project
// DELETE /api/projects/[id]?userId=USER_ID
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get project ID from the URL path: /api/projects/[id]
    const pathParts = request.nextUrl.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owner can remove members
    if (project.owner.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Only project owner can remove members' }, { status: 403 });
    }

    // Remove member from project
    project.members = project.members.filter(
      (member: import('mongoose').Types.ObjectId) => member.toString() !== userId
    );
    await project.save();

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Clear all chat messages for a project
// PUT /api/projects/[id]
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    // Get project ID from the URL path: /api/projects/[id]
    const pathParts = request.nextUrl.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owner can clear chats
    if (project.owner.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Only project owner can clear chats' }, { status: 403 });
    }

    // Clear chat messages
    project.chatMessages = [];
    await project.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}