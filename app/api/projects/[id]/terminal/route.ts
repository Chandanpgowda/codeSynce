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

// Map file extensions / language names to run commands
function getRunCommand(fileName: string, language: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = language.toLowerCase();

  // JavaScript / TypeScript
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext) || lang.includes('javascript') || lang.includes('typescript')) {
    return `node "${fileName}"`;
  }

  // Python
  if (ext === 'py' || lang.includes('python')) {
    return `python "${fileName}"`;
  }

  // C
  if (ext === 'c' || lang === 'c') {
    if (process.platform === 'win32') {
      return `gcc "${fileName}" -o output.exe 2>&1 && "output.exe" 2>&1`;
    }
    return `gcc "${fileName}" -o output.out 2>&1 && "./output.out" 2>&1`;
  }

  // C++
  if (['cpp', 'cc', 'cxx', 'c++', 'hpp'].includes(ext) || lang.includes('c++') || lang === 'cpp') {
    if (process.platform === 'win32') {
      return `g++ "${fileName}" -o output.exe 2>&1 && "output.exe" 2>&1`;
    }
    return `g++ "${fileName}" -o output.out 2>&1 && "./output.out" 2>&1`;
  }

  // C#
  if (ext === 'cs' || lang.includes('csharp') || lang === 'c#') {
    return `dotnet script "${fileName}" 2>&1 || (csc "/out:output.exe" "${fileName}" 2>&1 && "output.exe" 2>&1)`;
  }

  // Go
  if (ext === 'go' || lang === 'go') {
    return `go run "${fileName}" 2>&1`;
  }

  // Rust
  if (ext === 'rs' || lang === 'rust') {
    return `rustc "${fileName}" -o output 2>&1 && "./output" 2>&1`;
  }

  // Java
  if (ext === 'java' || lang === 'java') {
    if (process.platform === 'win32') {
      const baseName = fileName.replace(/\\.[^/.]+$/, '');
      return `javac "${fileName}" 2>&1 && java "${baseName}" 2>&1`;
    }
    return `javac "${fileName}" 2>&1 && java "$(basename "${fileName}" .java)" 2>&1`;
  }

  // PHP
  if (ext === 'php' || lang === 'php') {
    return `php "${fileName}" 2>&1`;
  }

  // Ruby
  if (ext === 'rb' || lang === 'ruby') {
    return `ruby "${fileName}" 2>&1`;
  }

  // Bash / Shell
  if (['sh', 'bash', 'zsh'].includes(ext) || lang.includes('shell') || lang === 'bash' || lang === 'sh') {
    return `bash "${fileName}" 2>&1`;
  }

  // HTML
  if (ext === 'html' || lang === 'html') {
    return `echo "Open this file in a browser to view: ${fileName}"`;
  }

  // SQL
  if (ext === 'sql' || lang === 'sql') {
    return `echo "SQL query ready to execute on your database."`;
  }

  // Default
  return `echo "Unsupported language for auto-run: ${lang}. Use the terminal manually."`;
}

// Get the file extension for a language
function getFileExtension(lang: string): string {
  const map: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    php: 'php',
    ruby: 'rb',
    bash: 'sh',
    shell: 'sh',
    html: 'html',
    css: 'css',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    lua: 'lua',
    kotlin: 'kt',
    swift: 'swift',
    dart: 'dart',
    r: 'r',
    scala: 'scala',
    haskell: 'hs',
  };
  return map[lang.toLowerCase()] || lang.toLowerCase();
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

    // Get or create workspace directory
    let cwd = projectCwds.get(params.id) || await syncFilesToWorkspace(params.id, project.files || []);
    projectCwds.set(params.id, cwd);

    // Handle run code request (doesn't require command field)
    if (body.runCode && body.code) {
      const code: string = body.code;
      const inputFileName: string = body.fileName || '';
      const inputFileLanguage: string = body.fileLanguage || project.language || '';

      // Determine filename
      let filename = inputFileName || `main.${getFileExtension(inputFileLanguage)}`;

      // Write code to workspace
      const filePath = path.join(cwd, filename);
      fs.writeFileSync(filePath, code);

      // Determine run command
      const runCommand = getRunCommand(filename, inputFileLanguage || project.language);

      // Execute the run command
      try {
        const { stdout, stderr } = await execAsync(runCommand, {
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
          output.push(`Error: Failed to execute code`);
        }
        return NextResponse.json({ output, cwd: cwd.replace(/\\/g, '/') });
      }
    }

    // For regular commands, command is required
    const { command } = body;
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

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