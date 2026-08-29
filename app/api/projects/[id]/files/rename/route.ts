import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordActivity } from '@/lib/activities';

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
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    bat: 'bat',
    dockerfile: 'dockerfile',
    gitignore: 'plaintext',
  };
  return languages[ext] || 'plaintext';
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

function findAndRename(nodes: FileNode[], fullPath: string, newName: string, oldName: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.path === fullPath) {
      // Found the item - rename it
      const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      const newFullPath = parentPath ? `${parentPath}/${newName}` : newName;
      node.name = newName;
      node.path = newFullPath;

      // If it's a folder, update all descendant paths
      if (node.type === 'folder' && node.children) {
        const oldPrefix = fullPath;
        const newPrefix = newFullPath;
        const updatePaths = (children: FileNode[]) => {
          for (const child of children) {
            child.path = child.path.replace(new RegExp(`^${oldPrefix}/`), `${newPrefix}/`);
            if (child.type === 'folder' && child.children) {
              updatePaths(child.children);
            }
          }
        };
        updatePaths(node.children);
      }

      // Update language for renamed files
      if (node.type === 'file') {
        (node as any).language = getLanguageFromName(newName);
      }
      return true;
    }
    if (node.type === 'folder' && node.children) {
      const found = findAndRename(node.children, fullPath, newName, oldName);
      if (found) return true;
    }
  }
  return false;
}

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

    const isMember = project.members.some((m: any) => m.toString() === session.user.id) ||
      project.owner.toString() === session.user.id;
    const canEdit = project.owner.toString() === session.user.id || project.memberPermissions?.get(session.user.id) !== 'viewer';
    if (!isMember || !canEdit) {
      return NextResponse.json({ error: 'Editor permission is required to rename files' }, { status: 403 });
    }
    if (project.status && project.status !== 'draft') {
      return NextResponse.json({ error: 'Project is submitted for evaluation and is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const { path, oldName, newName } = body;

    if (!path || !oldName || !newName) {
      return NextResponse.json(
        { error: 'path, oldName, and newName are required' },
        { status: 400 }
      );
    }

    if (newName.includes('/') || newName.includes('\\') || newName.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid name. Names cannot contain "/" or "\\"' },
        { status: 400 }
      );
    }

    // Check if new name already exists (duplicate check)
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    const newFullPath = parentPath ? `${parentPath}/${newName}` : newName;
    const existsDuplicate = (nodes: any[]): boolean => {
      for (const node of nodes) {
        if (node.path === newFullPath) return true;
        if (node.type === 'folder' && node.children) {
          if (existsDuplicate(node.children)) return true;
        }
      }
      return false;
    };

    if (existsDuplicate(project.files)) {
      return NextResponse.json(
        { error: `"${newName}" already exists` },
        { status: 409 }
      );
    }

    const renamed = findAndRename(project.files, path, newName.trim(), oldName);
    if (!renamed) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    project.markModified('files');
    project.lastEditedAt = new Date();
    project.lastEditedBy = session.user.id as any;
    await project.save();

    await recordActivity({
      project: project._id.toString(),
      user: session.user.id,
      activityType: 'file_renamed',
      message: `Renamed "${path}" to "${newFullPath}"`,
      file: newFullPath,
    });

    return NextResponse.json({ success: true, message: 'Renamed successfully' });
  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
