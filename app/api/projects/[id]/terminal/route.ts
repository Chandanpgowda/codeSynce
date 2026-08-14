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

// Map file extensions / language names to Piston API language
function getPistonLanguage(fileName: string, language: string): { language: string; version: string } | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = language.toLowerCase();

  // JavaScript / TypeScript
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext) || lang.includes('javascript') || lang.includes('typescript')) {
    return { language: 'javascript', version: '18.15.0' };
  }

  // Python
  if (ext === 'py' || lang.includes('python')) {
    return { language: 'python', version: '3.10.0' };
  }

  // C
  if (ext === 'c' || lang === 'c') {
    return { language: 'c', version: '10.2.0' };
  }

  // C++
  if (['cpp', 'cc', 'cxx', 'c++', 'hpp'].includes(ext) || lang.includes('c++') || lang === 'cpp') {
    return { language: 'c++', version: '10.2.0' };
  }

  // C#
  if (ext === 'cs' || lang.includes('csharp') || lang === 'c#') {
    return { language: 'csharp', version: '6.12.0' };
  }

  // Go
  if (ext === 'go' || lang === 'go') {
    return { language: 'go', version: '1.16.2' };
  }

  // Rust
  if (ext === 'rs' || lang === 'rust') {
    return { language: 'rust', version: '1.68.2' };
  }

  // Java
  if (ext === 'java' || lang === 'java') {
    return { language: 'java', version: '15.0.2' };
  }

  // PHP
  if (ext === 'php' || lang === 'php') {
    return { language: 'php', version: '8.2.3' };
  }

  // Ruby
  if (ext === 'rb' || lang === 'ruby') {
    return { language: 'ruby', version: '3.0.1' };
  }

  // Bash / Shell
  if (['sh', 'bash', 'zsh'].includes(ext) || lang.includes('shell') || lang === 'bash' || lang === 'sh') {
    return { language: 'bash', version: '5.2.0' };
  }

  // Lua
  if (ext === 'lua' || lang === 'lua') {
    return { language: 'lua', version: '5.4.4' };
  }

  // Kotlin
  if (ext === 'kt' || lang === 'kotlin') {
    return { language: 'kotlin', version: '1.8.20' };
  }

  // Swift
  if (ext === 'swift' || lang === 'swift') {
    return { language: 'swift', version: '5.3.3' };
  }

  // Dart
  if (ext === 'dart' || lang === 'dart') {
    return { language: 'dart', version: '3.1.0' };
  }

  // R
  if (ext === 'r' || lang === 'r') {
    return { language: 'r', version: '4.2.1' };
  }

  // Scala
  if (ext === 'scala' || lang === 'scala') {
    return { language: 'scala', version: '3.2.2' };
  }

  // Haskell
  if (ext === 'hs' || lang === 'haskell') {
    return { language: 'haskell', version: '9.0.1' };
  }

  return null;
}

// Execute code using Piston API (works on Vercel serverless)
async function executeWithPiston(code: string, fileName: string, language: string): Promise<string[]> {
  const pistonLang = getPistonLanguage(fileName, language);

  // HTML - just show a message
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || language.toLowerCase() === 'html') {
    return [`Open this file in a browser to view: ${fileName}`];
  }

  // SQL - just show a message
  if (ext === 'sql' || language.toLowerCase() === 'sql') {
    return [`SQL query ready to execute on your database.`];
  }

  if (!pistonLang) {
    return [`Unsupported language for auto-run: ${language}. Use the terminal manually.`];
  }

  try {
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: pistonLang.language,
        version: pistonLang.version,
        files: [
          {
            name: fileName,
            content: code,
          },
        ],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 10000,
      }),
    });

    if (!response.ok) {
      return [`Error: Code execution service returned ${response.status}`];
    }

    const result = await response.json();

    const output: string[] = [];

    // Compile output (for compiled languages like Java, C, C++)
    if (result.compile && result.compile.output) {
      const compileOutput = result.compile.output.trim();
      if (compileOutput) {
        output.push(...compileOutput.split('\n').filter((line: string) => line.length > 0));
      }
    }

    // Run output
    if (result.run && result.run.output) {
      const runOutput = result.run.output.trim();
      if (runOutput) {
        output.push(...runOutput.split('\n').filter((line: string) => line.length > 0));
      }
    }

    // If there's a run error (stderr)
    if (result.run && result.run.stderr) {
      const stderr = result.run.stderr.trim();
      if (stderr) {
        output.push(...stderr.split('\n').filter((line: string) => line.length > 0));
      }
    }

    if (output.length === 0) {
      output.push('');
    }

    return output;
  } catch (error) {
    return [`Error: Failed to execute code. The code execution service is unavailable.`];
  }
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

      // Execute using Piston API (works on Vercel serverless)
      const output = await executeWithPiston(code, filename, inputFileLanguage || project.language);

      return NextResponse.json({ output, cwd: cwd.replace(/\\/g, '/') });
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