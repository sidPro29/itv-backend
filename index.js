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

  // WebRTC Signaling Events (1-to-1 Legacy compatibility)
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

  // --- WebRTC Room & Multi-User Call Signaling ---
  socket.on('call_room_invite', ({ roomId, recipientIds, callerInfo, callType }) => {
    const list = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
    console.log(`[CallRoom] Invite to room ${roomId} for:`, list);
    list.forEach(targetId => {
      if (targetId) {
        io.to(targetId.toString()).emit('incoming_call_room', {
          roomId,
          callerInfo,
          callType,
          allRecipients: list
        });
      }
    });
  });

  socket.on('join_call_room', ({ roomId, userInfo }) => {
    if (!roomId) return;
    socket.join(`call_room_${roomId}`);
    socket.callRoomId = roomId;
    socket.callUserInfo = userInfo;
    console.log(`[CallRoom] User ${userInfo?.userId || socket.id} joined call room ${roomId}`);

    socket.to(`call_room_${roomId}`).emit('user_joined_call_room', {
      socketId: socket.id,
      userId: userInfo?.userId,
      userInfo
    });
  });

  socket.on('call_peer_offer', ({ targetSocketId, targetUserId, offer, senderInfo }) => {
    const payload = {
      senderSocketId: socket.id,
      senderUserId: senderInfo?.userId || socket.callUserInfo?.userId,
      offer,
      senderInfo: senderInfo || socket.callUserInfo
    };
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_peer_offer', payload);
    } else if (targetUserId) {
      io.to(targetUserId.toString()).emit('call_peer_offer', payload);
    }
  });

  socket.on('call_peer_answer', ({ targetSocketId, targetUserId, answer, senderInfo }) => {
    const payload = {
      senderSocketId: socket.id,
      senderUserId: senderInfo?.userId || socket.callUserInfo?.userId,
      answer,
      senderInfo: senderInfo || socket.callUserInfo
    };
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_peer_answer', payload);
    } else if (targetUserId) {
      io.to(targetUserId.toString()).emit('call_peer_answer', payload);
    }
  });

  socket.on('call_peer_ice', ({ targetSocketId, targetUserId, candidate }) => {
    const payload = {
      senderSocketId: socket.id,
      senderUserId: socket.callUserInfo?.userId,
      candidate
    };
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_peer_ice', payload);
    } else if (targetUserId) {
      io.to(targetUserId.toString()).emit('call_peer_ice', payload);
    }
  });

  socket.on('call_peer_track_state', ({ roomId, isAudioMuted, isVideoOff, isScreenSharing }) => {
    const rId = roomId || socket.callRoomId;
    if (rId) {
      socket.to(`call_room_${rId}`).emit('call_peer_track_state', {
        userId: socket.callUserInfo?.userId,
        socketId: socket.id,
        isAudioMuted,
        isVideoOff,
        isScreenSharing
      });
    }
  });

  socket.on('leave_call_room', ({ roomId }) => {
    const rId = roomId || socket.callRoomId;
    if (rId) {
      socket.leave(`call_room_${rId}`);
      socket.to(`call_room_${rId}`).emit('user_left_call_room', {
        socketId: socket.id,
        userId: socket.callUserInfo?.userId
      });
      socket.callRoomId = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
    if (socket.callRoomId) {
      socket.to(`call_room_${socket.callRoomId}`).emit('user_left_call_room', {
        socketId: socket.id,
        userId: socket.callUserInfo?.userId
      });
    }
  });
});

app.get('/', (req, res) => {
  res.send('ITV CMS API is running...');
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
