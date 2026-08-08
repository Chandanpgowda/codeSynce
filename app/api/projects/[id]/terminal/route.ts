import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  children?: FileNode[];
}

// Tree helpers
function getNode(tree: FileNode[], path: string): FileNode | null {
  if (!path || path === '/') return null;
  const parts = path.split('/').filter(Boolean);
  let current: FileNode[] = tree;
  let node: FileNode | null = null;
  for (const part of parts) {
    node = current.find((n) => n.name === part) || null;
    if (!node) return null;
    if (node.type === 'folder') current = node.children || [];
  }
  return node;
}

function getParent(tree: FileNode[], path: string): { parent: FileNode[]; child: FileNode | null } | null {
  if (!path) return { parent: tree, child: null };
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 1) return { parent: tree, child: tree.find((n) => n.name === parts[0]) || null };
  const parentPath = parts.slice(0, -1).join('/');
  const parentNode = getNode(tree, parentPath);
  if (!parentNode || parentNode.type !== 'folder') return null;
  return {
    parent: parentNode.children || [],
    child: parentNode.children?.find((n) => n.name === parts[parts.length - 1]) || null,
  };
}

function listChildren(tree: FileNode[], path: string): FileNode[] {
  if (!path || path === '/') return tree;
  const node = getNode(tree, path);
  if (!node) return [];
  if (node.type === 'folder') return node.children || [];
  return [];
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const langs: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', html: 'html',
    css: 'css', json: 'json', sql: 'sql', md: 'markdown', txt: 'plaintext',
  };
  return langs[ext] || 'plaintext';
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

    const tree: FileNode[] = project.files || [];
    const output: string[] = [];
    let cwd = '/';

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        output.push(
          'Available commands:',
          '  ls [path]        - List files/folders',
          '  cd <dir>         - Change directory',
          '  pwd              - Print working directory',
          '  mkdir <name>     - Create a folder',
          '  touch <name>     - Create a file',
          '  cat <file>       - View file content',
          '  echo <text>      - Print text',
          '  rm <path>        - Delete file/folder',
          '  clear            - Clear terminal',
          '  whoami           - Current user',
          '  date             - Current date/time',
          '  help             - Show this help'
        );
        break;

      case 'pwd':
        output.push(cwd);
        break;

      case 'ls': {
        const target = args[0] ? (args[0].startsWith('/') ? args[0] : cwd === '/' ? `/${args[0]}` : `${cwd}/${args[0]}`).replace(/\/+/g, '/').replace(/\/$/, '') || '/' : cwd;
        const children = listChildren(tree, target);
        if (target !== cwd && !getNode(tree, target)) {
          output.push(`ls: cannot access '${args[0]}': No such file or directory`);
        } else if (children.length === 0) {
          output.push('(empty)');
        } else {
          children.forEach((child) => {
            if (child.type === 'folder') output.push(`${child.name}/`);
            else output.push(`${child.name}  (${child.language || 'plaintext'})`);
          });
        }
        break;
      }

      case 'cd': {
        const target = args[0];
        if (!target || target === '~' || target === '/') {
          cwd = '/';
          break;
        }
        const full = target.startsWith('/') ? target : cwd === '/' ? `/${target}` : `${cwd}/${target}`;
        const clean = full.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        if (target === '..') {
          const parts2 = cwd.split('/').filter(Boolean);
          parts2.pop();
          cwd = '/' + parts2.join('/');
          break;
        }
        const node = getNode(tree, clean);
        if (node && node.type === 'folder') {
          cwd = clean;
        } else {
          output.push(`cd: no such file or directory: ${target}`);
        }
        break;
      }

      case 'mkdir': {
        const name = args[0];
        if (!name) {
          output.push('mkdir: missing operand');
          break;
        }
        if (name.includes('/')) {
          output.push('mkdir: only simple names supported');
          break;
        }
        const parentPath = cwd === '/' ? '' : cwd.replace(/^\//, '');
        const { parent } = getParent(tree, parentPath) || { parent: tree };
        if (parent.some((n) => n.name === name)) {
          output.push(`mkdir: cannot create directory '${name}': File exists`);
        } else {
          parent.push({
            name,
            path: parentPath ? `${parentPath}/${name}` : name,
            type: 'folder',
            children: [],
          });
          project.markModified('files');
          await project.save();
          output.push(`Created folder: ${name}`);
        }
        break;
      }

      case 'touch': {
        const name = args[0];
        if (!name) {
          output.push('touch: missing file operand');
          break;
        }
        if (name.includes('/')) {
          output.push('touch: only simple names supported');
          break;
        }
        const parentPath = cwd === '/' ? '' : cwd.replace(/^\//, '');
        const { parent } = getParent(tree, parentPath) || { parent: tree };
        if (parent.some((n) => n.name === name)) {
          output.push(`touch: '${name}' already exists`);
        } else {
          parent.push({
            name,
            path: parentPath ? `${parentPath}/${name}` : name,
            type: 'file',
            content: '',
            language: getLanguage(name),
          });
          project.markModified('files');
          await project.save();
          output.push(`Created file: ${name}`);
        }
        break;
      }

      case 'cat': {
        const name = args[0];
        if (!name) {
          output.push('cat: missing file operand');
          break;
        }
        const full = name.startsWith('/') ? name : cwd === '/' ? `/${name}` : `${cwd}/${name}`;
        const clean = full.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        const node = getNode(tree, clean);
        if (!node) {
          output.push(`cat: ${name}: No such file or directory`);
        } else if (node.type === 'folder') {
          output.push(`cat: ${name}: Is a directory`);
        } else {
          output.push(node.content || '(empty file)');
        }
        break;
      }

      case 'echo': {
        const text = args.join(' ');
        if (text.startsWith('>')) {
          // echo text > file
          const parts2 = text.split('>');
          const content = parts2[0].trim();
          const fileName = parts2[1]?.trim();
          if (fileName) {
            const full = fileName.startsWith('/') ? fileName : cwd === '/' ? `/${fileName}` : `${cwd}/${fileName}`;
            const clean = full.replace(/\/+/g, '/');
            const node = getNode(tree, clean);
            if (node && node.type === 'file') {
              node.content = content;
              project.markModified('files');
              await project.save();
              output.push(`Wrote to ${fileName}`);
            } else {
              output.push(`echo: ${fileName}: No such file`);
            }
          }
        } else {
          output.push(text);
        }
        break;
      }

      case 'rm': {
        const name = args[0];
        if (!name) {
          output.push('rm: missing operand');
          break;
        }
        const full = name.startsWith('/') ? name : cwd === '/' ? `/${name}` : `${cwd}/${name}`;
        const clean = full.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        const result = getParent(tree, clean);
        if (!result || !result.child) {
          output.push(`rm: cannot remove '${name}': No such file or directory`);
        } else {
          const idx = result.parent.findIndex((n) => n.path === result.child!.path);
          if (idx !== -1) result.parent.splice(idx, 1);
          project.markModified('files');
          await project.save();
          output.push(`Deleted: ${name}`);
        }
        break;
      }

      case 'whoami':
        output.push(session.user.name || 'User');
        break;

      case 'date':
        output.push(new Date().toString());
        break;

      case 'clear':
        output.push('__CLEAR__');
        break;

      default:
        output.push(`bash: ${cmd}: command not found`);
        output.push('Type "help" to see available commands');
    }

    return NextResponse.json({ output, cwd });
  } catch (error) {
    console.error('Terminal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}