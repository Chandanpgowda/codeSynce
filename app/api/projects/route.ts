import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';
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
    const scope = searchParams.get('scope') || ''; // 'mine' | 'collaborating' | ''

    const query: any = {};

    // Build base query for public projects
    if (!scope) {
      query.isPublic = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) {
      query.tags = tag;
    }

    // Filter by scope
    if (scope === 'mine') {
      query.owner = session.user.id;
    } else if (scope === 'collaborating') {
      query.$and = [
        { members: session.user.id },
        { owner: { $ne: session.user.id } },
      ];
    } else if (search) {
      // When searching, also include user's own projects even if private
      query.$or = [
        ...(query.$or || []),
        { owner: session.user.id },
        { members: session.user.id },
      ];
    }

    const projects = await Project.find(query)
      .populate('owner', 'name email image')
      .populate('members', 'name email image')
      .populate('pendingRequests', 'name email image')
      .populate('lastEditedBy', 'name email image')
      .sort({ lastEditedAt: -1 })
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
      lastEditedAt: new Date(),
      lastEditedBy: session.user.id,
    });

    // Add project to user's owned projects
    await User.findByIdAndUpdate(session.user.id, {
      $push: { projectsOwned: project._id },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}