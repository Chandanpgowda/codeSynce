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
    origin: '*',
    methods: ['GET', 'POST'],
  },
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

  // Chat messages
  socket.on('send-message', ({ projectId, message, user }) => {
    io.to(`project:${projectId}`).emit('new-message', {
      user,
      message,
      timestamp: new Date().toISOString(),
    });
  });

  // Cursor position updates
  socket.on('cursor-update', ({ projectId, position, user }) => {
    socket.to(`project:${projectId}`).emit('cursor-moved', {
      user,
      position,
    });
  });

  // File changes
  socket.on('file-change', ({ projectId, file, content }) => {
    socket.to(`project:${projectId}`).emit('file-updated', {
      file,
      content,
      user: socket.data.user,
    });
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