// DB Updated with Hello1234 - Restarting server
globalThis.crypto = require('crypto').webcrypto;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger middleware for tracing performance/duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use('/uploads', express.static('/app/uploads', { maxAge: '30d' }));
app.use('/api/uploads', express.static('/app/uploads', { maxAge: '30d' }));

// MongoDB Connection
const seedPages = require('./scripts/seedPages');
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    seedPages();
  })
  .catch(err => console.log('MongoDB Connection Error:', err));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/media-assets', require('./routes/mediaAssets'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/cms-users', require('./routes/adminCmsUsers'));
app.use('/api', require('./routes/upload'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/apks', require('./routes/apks'));
app.use('/api/community', require('./routes/community'));
app.use('/api/admin/community', require('./routes/adminCommunity'));


const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io WebRTC Signaling & Real-time Messaging
io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  socket.on('register_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`[Socket] User ${userId} joined socket room`);
    }
  });

  socket.on('send_message', (data) => {
    if (data && data.recipientId) {
      io.to(data.recipientId.toString()).emit('receive_message', data);
    }
  });

  // WebRTC Signaling Events
  socket.on('call_user', ({ recipientId, offer, callType, callerInfo }) => {
    console.log(`[Call] Call initiated to ${recipientId} (${callType})`);
    io.to(recipientId.toString()).emit('incoming_call', {
      callerId: callerInfo?.userId,
      callerName: callerInfo?.fullName,
      callerAvatar: callerInfo?.avatarUrl,
      offer,
      callType
    });
  });

  socket.on('answer_call', ({ callerId, answer }) => {
    console.log(`[Call] Call accepted for ${callerId}`);
    io.to(callerId.toString()).emit('call_accepted', { answer });
  });

  socket.on('ice_candidate', ({ targetId, candidate }) => {
    if (targetId) {
      io.to(targetId.toString()).emit('ice_candidate', { candidate });
    }
  });

  socket.on('reject_call', ({ targetId }) => {
    if (targetId) {
      io.to(targetId.toString()).emit('call_rejected');
    }
  });

  socket.on('end_call', ({ targetId }) => {
    if (targetId) {
      io.to(targetId.toString()).emit('call_ended');
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('ITV CMS API is running...');
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
