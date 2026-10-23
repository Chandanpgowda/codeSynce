import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordActivity } from '@/lib/activities';

// Helper functions for file tree manipulation
function getLanguageFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const languages: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    html: 'html',
    css: 'css',
    json: 'json',
    sql: 'sql',
    md: 'markdown',
    txt: 'plaintext',
  };
  return languages[ext] || 'plaintext';
}

function findParent(files: any[], parentPath: string): any[] | null {
  if (!parentPath) return files;
  for (const item of files) {
    if (item.type === 'folder' && item.path === parentPath) {
      return item.children;
    }
    if (item.type === 'folder') {
      const found = findParent(item.children, parentPath);
      if (found) return found;
    }
  }
  return null;
}

function removeItem(files: any[], path: string): boolean {
  for (let i = 0; i < files.length; i++) {
    if (files[i].path === path) {
      files.splice(i, 1);
      return true;
    }
    if (files[i].type === 'folder') {
      const removed = removeItem(files[i].children, path);
      if (removed) return true;
    }
  }
  return false;
}

function findFile(files: any[], path: string): any | null {
  for (const item of files) {
    if (item.path === path) return item;
    if (item.type === 'folder') {
      const found = findFile(item.children, path);
      if (found) return found;
    }
  }
  return null;
}

// Create file or folder
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a member
    const isMember = project.members.some((m: any) => m.toString() === session.user.id) ||
      project.owner.toString() === session.user.id;
    const canEdit = project.owner.toString() === session.user.id || project.memberPermissions?.get(session.user.id) !== 'viewer';
    if (!isMember || !canEdit) {
      return NextResponse.json({ error: 'Editor permission is required to modify files' }, { status: 403 });
    }
    // Evidence preservation: files are locked once the project is submitted for evaluation.
    if (project.status && project.status !== 'draft') {
      return NextResponse.json({ error: 'Project is submitted for evaluation and is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { type, name, parentPath, content } = body;

    if (!type || !name || (type !== 'file' && type !== 'folder')) {
      return NextResponse.json(
        { error: 'type (file/folder) and name are required' },
        { status: 400 }
      );
    }

    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    // Check if item already exists
    if (findFile(project.files, fullPath)) {
      return NextResponse.json(
        { error: `"${name}" already exists` },
        { status: 409 }
      );
    }

    const parent = findParent(project.files, parentPath || '');
    if (parentPath && !parent) {
      return NextResponse.json(
        { error: 'Parent folder not found' },
        { status: 404 }
      );
    }

    const newItem = {
      name,
      path: fullPath,
      type,
      ...(type === 'file'
        ? { content: content !== undefined ? content : '', language: getLanguageFromName(name) }
        : { children: [] }),
    };

    parent!.push(newItem);
    project.markModified('files');
    project.lastEditedAt = new Date();
    project.lastEditedBy = session.user.id as any;
    await project.save();

    await recordActivity({
      project: project._id.toString(),
      user: session.user.id,
      activityType: type === 'file' ? 'file_created' : 'other',
      message: `${type === 'file' ? 'Created file' : 'Created folder'} "${fullPath}"`,
      file: fullPath,
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Create file/folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update file content
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

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isMember = project.members.some((m: any) => m.toString() === session.user.id) ||
      project.owner.toString() === session.user.id;
    const canEdit = project.owner.toString() === session.user.id || project.memberPermissions?.get(session.user.id) !== 'viewer';
    if (!isMember || !canEdit) {
      return NextResponse.json({ error: 'Editor permission is required to modify files' }, { status: 403 });
    }
    // Evidence preservation: files are locked once the project is submitted for evaluation.
    if (project.status && project.status !== 'draft') {
      return NextResponse.json({ error: 'Project is submitted for evaluation and is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { path, content } = body;

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: 'path and content are required' },
        { status: 400 }
      );
    }

    const file = findFile(project.files, path);
    if (!file || file.type !== 'file') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    file.content = content;
    project.markModified('files');
    project.lastEditedAt = new Date();
    project.lastEditedBy = session.user.id as any;
    await project.save();

    await recordActivity({
      project: project._id.toString(),
      user: session.user.id,
      activityType: 'file_modified',
      message: `Modified file "${path}"`,
      file: path,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete file or folder
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

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isMember = project.members.some((m: any) => m.toString() === session.user.id) ||
      project.owner.toString() === session.user.id;
    const canEdit = project.owner.toString() === session.user.id || project.memberPermissions?.get(session.user.id) !== 'viewer';
    if (!isMember || !canEdit) {
      return NextResponse.json({ error: 'Editor permission is required to modify files' }, { status: 403 });
    }
    // Evidence preservation: files are locked once the project is submitted for evaluation.
    if (project.status && project.status !== 'draft') {
      return NextResponse.json({ error: 'Project is submitted for evaluation and is read-only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'path query parameter is required' },
        { status: 400 }
      );
    }

    const removed = removeItem(project.files, path);
    if (!removed) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    project.markModified('files');
    project.lastEditedAt = new Date();
    project.lastEditedBy = session.user.id as any;
    await project.save();

    await recordActivity({
      project: project._id.toString(),
      user: session.user.id,
      activityType: 'file_deleted',
      message: `Deleted "${path}"`,
      file: path,
    });

    return NextResponse.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
