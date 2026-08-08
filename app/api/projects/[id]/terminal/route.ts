import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const execAsync = promisify(exec);

// Store working directories per project
const projectCwds = new Map<string, string>();

// Get the workspace directory for a project
function getWorkspaceDir(projectId: string): string {
  const baseDir = path.join(os.tmpdir(), 'codesynce-workspaces');
  const projectDir = path.join(baseDir, projectId);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  return projectDir;
}

// Sync project files to the workspace directory
async function syncFilesToWorkspace(projectId: string, files: any[]): Promise<string> {
  const workspaceDir = getWorkspaceDir(projectId);
  
  // Clear existing files
  fs.rmSync(workspaceDir, { recursive: true, force: true });
  fs.mkdirSync(workspaceDir, { recursive: true });

  // Write all files
  const writeFiles = (items: any[], currentPath: string) => {
    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      if (item.type === 'folder') {
        fs.mkdirSync(itemPath, { recursive: true });
        if (item.children) {
          writeFiles(item.children, itemPath);
        }
      } else {
        fs.mkdirSync(path.dirname(itemPath), { recursive: true });
        fs.writeFileSync(itemPath, item.content || '');
      }
    }
  };

  writeFiles(files, workspaceDir);
  return workspaceDir;
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
    if (!isMember) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
    }

    const body = await request.json();
    const { command } = body;
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Get or create workspace directory
    let cwd = projectCwds.get(params.id) || await syncFilesToWorkspace(params.id, project.files || []);
    projectCwds.set(params.id, cwd);

    // Handle cd command specially to track directory
    const trimmed = command.trim();
    if (trimmed.startsWith('cd ')) {
      const target = trimmed.slice(3).trim();
      try {
        const newCwd = path.resolve(cwd, target);
        if (fs.existsSync(newCwd) && fs.statSync(newCwd).isDirectory()) {
          cwd = newCwd;
          projectCwds.set(params.id, cwd);
          return NextResponse.json({ output: [], cwd: cwd.replace(/\\/g, '/') });
        } else {
          return NextResponse.json({
            output: [`bash: cd: ${target}: No such file or directory`],
            cwd: cwd.replace(/\\/g, '/'),
          });
        }
      } catch (err) {
        return NextResponse.json({
          output: [`bash: cd: ${target}: No such file or directory`],
          cwd: cwd.replace(/\\/g, '/'),
        });
      }
    }

    // Handle clear command
    if (trimmed === 'clear' || trimmed === 'cls') {
      return NextResponse.json({ output: ['__CLEAR__'], cwd: cwd.replace(/\\/g, '/') });
    }

    // Execute the command in the workspace
    try {
      const { stdout, stderr } = await execAsync(trimmed, {
        cwd,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          PATH: process.env.PATH,
        },
      });

      const output: string[] = [];
      if (stdout) {
        output.push(...stdout.split('\n').filter((line: string) => line.length > 0));
      }
      if (stderr) {
        output.push(...stderr.split('\n').filter((line: string) => line.length > 0));
      }
      if (output.length === 0) {
        output.push('');
      }

      return NextResponse.json({ output, cwd: cwd.replace(/\\/g, '/') });
    } catch (execError: any) {
      const output: string[] = [];
      if (execError.stdout) {
        output.push(...execError.stdout.split('\n').filter((line: string) => line.length > 0));
      }
      if (execError.stderr) {
        output.push(...execError.stderr.split('\n').filter((line: string) => line.length > 0));
      }
      if (output.length === 0) {
        output.push(`bash: ${trimmed}: command not found`);
      }
      return NextResponse.json({ output, cwd: cwd.replace(/\\/g, '/') });
    }
  } catch (error) {
    console.error('Terminal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}