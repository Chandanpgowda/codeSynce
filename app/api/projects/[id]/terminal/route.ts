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

// Map file extensions / language names to Wandbox compiler names
function getWandboxCompiler(fileName: string, language: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = language.toLowerCase();

  // JavaScript / TypeScript
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext) || lang.includes('javascript')) {
    return 'nodejs-18.20.4';
  }
  if (lang.includes('typescript')) {
    return 'typescript-5.6.2';
  }

  // Python
  if (ext === 'py' || lang.includes('python')) {
    return 'cpython-3.10.15';
  }

  // C
  if (ext === 'c' || lang === 'c') {
    return 'gcc-13.2.0-c';
  }

  // C++
  if (['cpp', 'cc', 'cxx', 'c++', 'hpp'].includes(ext) || lang.includes('c++') || lang === 'cpp') {
    return 'gcc-13.2.0';
  }

  // C#
  if (ext === 'cs' || lang.includes('csharp') || lang === 'c#') {
    return 'mono-6.12.0.199';
  }

  // Go
  if (ext === 'go' || lang === 'go') {
    return 'go-1.23.2';
  }

  // Rust
  if (ext === 'rs' || lang === 'rust') {
    return 'rust-1.82.0';
  }

  // Java
  if (ext === 'java' || lang === 'java') {
    return 'openjdk-jdk-21+35';
  }

  // PHP
  if (ext === 'php' || lang === 'php') {
    return 'php-8.3.12';
  }

  // Ruby
  if (ext === 'rb' || lang === 'ruby') {
    return 'ruby-3.3.11';
  }

  // Bash / Shell
  if (['sh', 'bash', 'zsh'].includes(ext) || lang.includes('shell') || lang === 'bash' || lang === 'sh') {
    return 'bash';
  }

  // Lua
  if (ext === 'lua' || lang === 'lua') {
    return 'lua-5.4.7';
  }

  // Swift
  if (ext === 'swift' || lang === 'swift') {
    return 'swift-6.0.1';
  }

  // R
  if (ext === 'r' || lang === 'r') {
    return 'r-4.4.1';
  }

  // Scala
  if (ext === 'scala' || lang === 'scala') {
    return 'scala-3.5.1';
  }

  // Haskell
  if (ext === 'hs' || lang === 'haskell') {
    return 'ghc-9.10.1';
  }

  return null;
}

// Execute code using Wandbox API (works on Vercel serverless)
interface ExecutionResult {
  output: string[];
  errors: string[];
  status: 'completed' | 'failed';
}

async function executeWithWandbox(
  code: string,
  fileName: string,
  language: string,
  stdin: string,
  signal?: AbortSignal
): Promise<ExecutionResult> {
  const compiler = getWandboxCompiler(fileName, language);

  // HTML - just show a message
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || language.toLowerCase() === 'html') {
    return { output: [`Open this file in a browser to view: ${fileName}`], errors: [], status: 'completed' };
  }

  // SQL - just show a message
  if (ext === 'sql' || language.toLowerCase() === 'sql') {
    return { output: [`SQL query ready to execute on your database.`], errors: [], status: 'completed' };
  }

  if (!compiler) {
    return { output: [], errors: [`Unsupported language for auto-run: ${language}.`], status: 'failed' };
  }

  try {
    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        code: code,
        compiler: compiler,
        options: '',
        stdin,
      }),
    });

    if (!response.ok) {
      return { output: [], errors: [`Code execution service returned ${response.status}`], status: 'failed' };
    }

    const result = await response.json();

    const output: string[] = [];
    const errors: string[] = [];

    // Compiler output (for compiled languages like Java, C, C++)
    if (result.compiler_output) {
      const compilerOutput = result.compiler_output.trim();
      if (compilerOutput) {
        output.push(...compilerOutput.split('\n').filter((line: string) => line.length > 0));
      }
    }

    // Compiler error
    if (result.compiler_error) {
      const compilerError = result.compiler_error.trim();
      if (compilerError) {
        errors.push(...compilerError.split('\n').filter((line: string) => line.length > 0));
      }
    }

    // Program output
    if (result.program_output) {
      const programOutput = result.program_output.trim();
      if (programOutput) {
        output.push(...programOutput.split('\n').filter((line: string) => line.length > 0));
      }
    }

    // Program error
    if (result.program_error) {
      const programError = result.program_error.trim();
      if (programError) {
        errors.push(...programError.split('\n').filter((line: string) => line.length > 0));
      }
    }

    return { output, errors, status: errors.length > 0 ? 'failed' : 'completed' };
  } catch (error) {
    return { output: [], errors: ['Failed to execute code. The code execution service is unavailable.'], status: 'failed' };
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

      // Execute using Wandbox API (works on Vercel serverless)
      const stdin = typeof body.stdin === 'string' ? body.stdin.slice(0, 10000) : '';
      const execution = await executeWithWandbox(
        code,
        filename,
        inputFileLanguage || project.language,
        stdin,
        request.signal
      );

      return NextResponse.json({ ...execution, cwd: cwd.replace(/\\/g, '/') });
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
        const errMsg = execError.message || '';
        if (errMsg.includes('command not found') || errMsg.includes('not recognized')) {
          const cmd = trimmed.split(' ')[0];
          output.push(`bash: ${cmd}: command not found`);
          output.push(`Note: This environment only supports basic commands (ls, cd, echo, node, npm, cat, etc.)`);
          output.push(`For running code, use the "Run Code" button instead.`);
        } else {
          output.push(`bash: ${trimmed}: command not found`);
        }
      }
      return NextResponse.json({ output, cwd: cwd.replace(/\\/g, '/') });
    }
  } catch (error) {
    console.error('Terminal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
