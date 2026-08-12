require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { Server } = require('socket.io');
const http = require('http');
const mongoose = require('mongoose');
const { setupWSConnection } = require('y-websocket/bin/utils');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CodeSynce Socket Server');
});

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000'
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
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
  }],
}, { timestamps: true });

const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

// Store active users per project
const projectUsers = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-project', ({ projectId, user }) => {
    socket.join(`project:${projectId}`);
    socket.data.projectId = projectId;
    socket.data.user = user;

    if (!projectUsers.has(projectId)) {
      projectUsers.set(projectId, new Map());
    }
    projectUsers.get(projectId).set(socket.id, user);

    // Notify all users in the project
    io.to(`project:${projectId}`).emit('user-joined', {
      user,
      users: Array.from(projectUsers.get(projectId).values()),
    });
  });

  socket.on('leave-project', ({ projectId }) => {
    socket.leave(`project:${projectId}`);
    if (projectUsers.has(projectId)) {
      projectUsers.get(projectId).delete(socket.id);
      io.to(`project:${projectId}`).emit('user-left', {
        user: socket.data.user,
        users: Array.from(projectUsers.get(projectId).values()),
      });
    }
  });

  // Chat messages - broadcast and persist to MongoDB
  socket.on('send-message', async (data) => {
    // Validate input
    if (!data || typeof data !== 'object') {
      return;
    }

    const { projectId, message, user } = data;

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
    };

    // Broadcast to all users in the project
    io.to(`project:${projectId}`).emit('new-message', msg);

    // Persist to MongoDB
    try {
      await Project.findByIdAndUpdate(projectId, {
        $push: {
          chatMessages: {
            user: user?._id || user?.id,
            message: sanitizedMessage,
            timestamp: new Date(),
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

    socket.to(`project:${data.projectId}`).emit('cursor-moved', {
      user: data.user,
      position: data.position,
    });
  });

  // File changes
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
    });
  });

  // Add rate limiting for messages
  const messageRateLimit = new Map();

  socket.on('send-message', async (data) => {
    if (!data || !data.projectId || !data.user) {
      return;
    }

    const userId = data.user._id || data.user.id;
    const now = Date.now();
    const key = `${data.projectId}:${userId}`;

    // Check rate limit (max 10 messages per 5 seconds)
    if (messageRateLimit.has(key)) {
    const timestamps = messageRateLimit.get(key);
    const recentMessages = timestamps.filter((ts) => now - ts < 5000);

      if (recentMessages.length >= 10) {
        console.error('Rate limit exceeded for user:', userId);
        return;
      }

      timestamps.push(now);
      messageRateLimit.set(key, timestamps);
    } else {
      messageRateLimit.set(key, [now]);
    }

    // Clean up old entries
    setTimeout(() => {
      if (messageRateLimit.has(key)) {
        const timestamps = messageRateLimit.get(key);
        const filtered = timestamps.filter((ts) => now - ts < 5000);
        if (filtered.length === 0) {
          messageRateLimit.delete(key);
        } else {
          messageRateLimit.set(key, filtered);
        }
      }
    }, 6000);
  });

  socket.on('disconnect', () => {
    const { projectId, user } = socket.data;
    if (projectId && projectUsers.has(projectId)) {
      projectUsers.get(projectId).delete(socket.id);
      io.to(`project:${projectId}`).emit('user-left', {
        user,
        users: Array.from(projectUsers.get(projectId).values()),
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