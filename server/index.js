require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { Server } = require('socket.io');
const http = require('http');
const mongoose = require('mongoose');
const { setupWSConnection } = require('y-websocket/bin/utils');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CodeSynce Socket Server');
});

const socketCorsOrigin = process.env.SOCKET_CORS_ORIGIN || '*';
const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    ...(socketCorsOrigin !== '*' && { credentials: true }),
  },
  maxHttpBufferSize: 1e6, // 1MB limit
  transports: ['websocket', 'polling'],
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI).then(() => {
    console.log('MongoDB connected');
  }).catch((err) => {
    console.error('MongoDB connection error:', err);
  });
}

// Project model
const ProjectSchema = new mongoose.Schema({
  name: String,
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  language: String,
  tags: [String],
  isPublic: Boolean,
  files: mongoose.Schema.Types.Mixed,
  chatMessages: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: Date,
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    codeSnippetLanguage: String,
    codeSnippetCode: String,
    mentions: [String],
    fileReferenceProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    fileReferencePath: String,
    fileReferenceLine: Number,
  }],
}, { timestamps: true });

const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

// Store active users per project: projectId -> Map<socketId, { user, connectedAt, typingSince, currentFile }>
const projectUsers = new Map();

// Store typing timeouts: projectId -> Map<userId, timeout>
const typingTimeouts = new Map();

// Store chat typing timeouts (separate from code editor typing): projectId -> Map<userId, timeout>
const chatTypingTimeouts = new Map();

// Generate a consistent color for a user based on their ID
function getUserColor(userId) {
  const colors = [
    '#f94144', '#f3722c', '#f8961e', '#f9c74f',
    '#90be6d', '#43aa8b', '#4d908e', '#577590',
    '#277da1', '#e63946', '#f4a261', '#2a9d8f',
    '#e76f51', '#8ecae6', '#ffb703', '#fb8500',
    '#06d6a0', '#118ab2', '#ef476f', '#8338ec',
    '#3a86ff', '#ff006e', '#7b2cbf', '#00bbf9',
  ];
  let hash = 0;
  const str = String(userId || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getOnlineUsers(projectId) {
  if (!projectUsers.has(projectId)) return [];
  return Array.from(projectUsers.get(projectId).values()).map((data) => ({
    ...data.user,
    connectedAt: data.connectedAt,
    typing: data.typing || false,
    currentFile: data.currentFile || null,
    color: getUserColor(data.user?._id || data.user?.id),
    socketId: data.socketId,
  }));
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-project', ({ projectId, user }) => {
    socket.join(`project:${projectId}`);
    socket.data.projectId = projectId;
    socket.data.user = user;

    if (!projectUsers.has(projectId)) {
      projectUsers.set(projectId, new Map());
    }

    projectUsers.get(projectId).set(socket.id, {
      user,
      connectedAt: new Date().toISOString(),
      typing: false,
      currentFile: null,
      socketId: socket.id,
    });

    // Reset typing timeout if exists
    const userId = user?._id || user?.id;
    if (typingTimeouts.has(projectId)) {
      const userTimeout = typingTimeouts.get(projectId);
      if (userTimeout.has(userId)) {
        clearTimeout(userTimeout.get(userId));
        userTimeout.delete(userId);
      }
    }

    // Send current online users to the newly joined user
    socket.emit('presence-state', {
      users: getOnlineUsers(projectId),
    });

    // Notify all users in the project
    io.to(`project:${projectId}`).emit('user-joined', {
      user,
      users: getOnlineUsers(projectId),
    });
  });

  socket.on('leave-project', ({ projectId }) => {
    socket.leave(`project:${projectId}`);
    if (projectUsers.has(projectId)) {
      projectUsers.get(projectId).delete(socket.id);

      const userId = socket.data.user?._id || socket.data.user?.id;
      if (typingTimeouts.has(projectId)) {
        const userTimeout = typingTimeouts.get(projectId);
        if (userTimeout.has(userId)) {
          clearTimeout(userTimeout.get(userId));
          userTimeout.delete(userId);
        }
      }

      io.to(`project:${projectId}`).emit('user-left', {
        user: socket.data.user,
        users: getOnlineUsers(projectId),
      });
    }
  });

  // Chat messages - broadcast and persist to MongoDB
  socket.on('send-message', async (data) => {
    // Validate input
    if (!data || typeof data !== 'object') {
      return;
    }

    const { projectId, message, user, replyTo, codeSnippet, mentions, fileReference } = data;

    // Validate required fields
    if (!projectId || !message || !user) {
      console.error('Invalid message data received');
      return;
    }

    // Sanitize message
    const sanitizedMessage = String(message).trim().slice(0, 5000); // Limit message length

    if (!sanitizedMessage) {
      return;
    }

    const msg = {
      user: {
        _id: user?._id || user?.id,
        name: user?.name,
        image: user?.image,
      },
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      replyTo: replyTo || undefined,
      codeSnippet: codeSnippet || undefined,
      mentions: mentions || [],
      fileReference: fileReference || undefined,
    };

    // Broadcast to all OTHER users in the project (sender gets optimistic update)
    socket.to(`project:${projectId}`).emit('new-message', msg);

    // Browser clients persist through the authenticated Next.js API. Keep this
    // fallback for older clients while avoiding duplicate records for new ones.
    if (data.persisted) {
      return;
    }

    // Persist to MongoDB
    try {

      await Project.findByIdAndUpdate(projectId, {
        $push: {
          chatMessages: {
            user: user?._id || user?.id,
            message: sanitizedMessage,
            timestamp: new Date(),
            replyTo: replyTo || undefined,
            codeSnippetLanguage: codeSnippet?.language || undefined,
            codeSnippetCode: codeSnippet?.code || undefined,
            mentions: mentions || [],
            fileReferenceProject: fileReference?.projectId || undefined,
            fileReferencePath: fileReference?.filePath || undefined,
            fileReferenceLine: fileReference?.lineNumber || undefined,
          },
        },
      });
    } catch (err) {
      console.error('Failed to save chat message:', err);
    }
  });

  // Cursor position updates
  socket.on('cursor-update', (data) => {
    // Validate input
    if (!data || !data.projectId || !data.position || !data.user) {
      return;
    }

    // Update current file in presence data
    if (data.file && projectUsers.has(data.projectId)) {
      const userData = projectUsers.get(data.projectId).get(socket.id);
      if (userData) {
        userData.currentFile = data.file;
      }
    }

    socket.to(`project:${data.projectId}`).emit('cursor-moved', {
      user: data.user,
      position: data.position,
      file: data.file,
      color: getUserColor(data.user?._id || data.user?.id),
    });
  });

  // Selection changes
  socket.on('selection-change', (data) => {
    if (!data || !data.projectId || !data.selection || !data.user) {
      return;
    }

    socket.to(`project:${data.projectId}`).emit('selection-updated', {
      user: data.user,
      selection: data.selection,
      file: data.file,
      color: getUserColor(data.user?._id || data.user?.id),
    });
  });

  // Typing indicators
  socket.on('typing-start', (data) => {
    if (!data || !data.projectId || !data.user) {
      return;
    }

    const userId = data.user?._id || data.user?.id;
    const projectId = data.projectId;

    // Update presence state
    if (projectUsers.has(projectId)) {
      const userData = projectUsers.get(projectId).get(socket.id);
      if (userData) {
        userData.typing = true;
        userData.currentFile = data.file || userData.currentFile;
      }
    }

    // Set timeout to auto-clear typing after 3s
    if (!typingTimeouts.has(projectId)) {
      typingTimeouts.set(projectId, new Map());
    }
    const userTimeouts = typingTimeouts.get(projectId);
    if (userTimeouts.has(userId)) {
      clearTimeout(userTimeouts.get(userId));
    }
    userTimeouts.set(userId, setTimeout(() => {
      // Broadcast typing stopped
      if (projectUsers.has(projectId)) {
        const ud = projectUsers.get(projectId).get(socket.id);
        if (ud) ud.typing = false;
      }
      io.to(`project:${projectId}`).emit('typing-stopped', {
        user: data.user,
        users: getOnlineUsers(projectId),
      });
      userTimeouts.delete(userId);
    }, 3000));

    io.to(`project:${projectId}`).emit('typing-started', {
      user: data.user,
      file: data.file,
      users: getOnlineUsers(projectId),
    });
  });

  socket.on('typing-stop', (data) => {
    if (!data || !data.projectId || !data.user) {
      return;
    }

    const userId = data.user?._id || data.user?.id;
    const projectId = data.projectId;

    // Clear typing state
    if (projectUsers.has(projectId)) {
      const userData = projectUsers.get(projectId).get(socket.id);
      if (userData) {
        userData.typing = false;
      }
    }

    if (typingTimeouts.has(projectId)) {
      const userTimeouts = typingTimeouts.get(projectId);
      if (userTimeouts.has(userId)) {
        clearTimeout(userTimeouts.get(userId));
        userTimeouts.delete(userId);
      }
    }

    io.to(`project:${projectId}`).emit('typing-stopped', {
      user: data.user,
      users: getOnlineUsers(projectId),
    });
  });

  // Chat typing indicators (separate from code editor typing)
  socket.on('chat-typing-start', (data) => {
    if (!data || !data.projectId || !data.user) {
      return;
    }

    const userId = data.user?._id || data.user?.id;
    const projectId = data.projectId;

    // Auto-clear after 2.5s of inactivity
    if (!chatTypingTimeouts.has(projectId)) {
      chatTypingTimeouts.set(projectId, new Map());
    }
    const userTimeouts = chatTypingTimeouts.get(projectId);
    if (userTimeouts.has(userId)) {
      clearTimeout(userTimeouts.get(userId));
    }
    userTimeouts.set(userId, setTimeout(() => {
      io.to(`project:${projectId}`).emit('chat-typing-stopped', { user: data.user });
      userTimeouts.delete(userId);
    }, 2500));

    // Broadcast to everyone else in the room
    socket.to(`project:${projectId}`).emit('chat-typing-started', { user: data.user });
  });

  socket.on('chat-typing-stop', (data) => {
    if (!data || !data.projectId || !data.user) {
      return;
    }

    const userId = data.user?._id || data.user?.id;
    const projectId = data.projectId;

    if (chatTypingTimeouts.has(projectId)) {
      const userTimeouts = chatTypingTimeouts.get(projectId);
      if (userTimeouts.has(userId)) {
        clearTimeout(userTimeouts.get(userId));
        userTimeouts.delete(userId);
      }
    }

    socket.to(`project:${projectId}`).emit('chat-typing-stopped', { user: data.user });
  });

  // File changes (broadcast content)
  socket.on('file-change', (data) => {
    // Validate input
    if (!data || !data.projectId || !data.file || typeof data.content !== 'string') {
      return;
    }

    // Limit content size (10MB)
    if (data.content.length > 10 * 1024 * 1024) {
      console.error('File content too large');
      return;
    }

    socket.to(`project:${data.projectId}`).emit('file-updated', {
      file: data.file,
      content: data.content,
      user: socket.data.user,
      timestamp: new Date().toISOString(),
    });
  });

  // File saved to database
  socket.on('file-saved', (data) => {
    if (!data || !data.projectId || !data.file) {
      return;
    }

    io.to(`project:${data.projectId}`).emit('file-saved-broadcast', {
      file: data.file,
      user: data.user || socket.data.user,
      timestamp: new Date().toISOString(),
    });
  });

  // File opened
  socket.on('file-opened', (data) => {
    if (!data || !data.projectId || !data.file) {
      return;
    }

    if (projectUsers.has(data.projectId)) {
      const userData = projectUsers.get(data.projectId).get(socket.id);
      if (userData) {
        userData.currentFile = data.file;
      }
    }

    socket.to(`project:${data.projectId}`).emit('file-opened-broadcast', {
      user: data.user || socket.data.user,
      file: data.file,
      users: getOnlineUsers(data.projectId),
    });
  });

  socket.on('disconnect', () => {
    const { projectId, user } = socket.data;

    if (projectId && projectUsers.has(projectId)) {
      projectUsers.get(projectId).delete(socket.id);

      // Clear typing state
      const userId = user?._id || user?.id;
      if (typingTimeouts.has(projectId)) {
        const userTimeouts = typingTimeouts.get(projectId);
        if (userTimeouts.has(userId)) {
          clearTimeout(userTimeouts.get(userId));
          userTimeouts.delete(userId);
        }
      }

      io.to(`project:${projectId}`).emit('user-left', {
        user,
        users: getOnlineUsers(projectId),
      });
    }
    console.log('Client disconnected:', socket.id);
  });

  // Handle invalid events
  socket.on('invalid-event', () => {
    console.warn('Invalid event received from socket:', socket.id);
  });
});

// Yjs WebSocket provider for collaborative editing
const wss = new (require('ws').Server)({ server, path: '/collab' });

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CodeSynce server running on port ${PORT}`);
});
