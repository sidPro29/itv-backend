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

// WebRTC Slack-Style Persistent Call Rooms
const activeCallRooms = global.activeCallRooms || new Map();
global.activeCallRooms = activeCallRooms;

// Socket.io WebRTC Signaling & Real-time Messaging
io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  socket.on('register_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`[Socket] User ${userId} joined socket room`);

      // Immediately inform reconnected / refreshed user of any active calls they belong to (Slack style)
      for (const room of activeCallRooms.values()) {
        if (room && room.participants && room.participants.size > 0) {
          const isParticipantOrInvited = 
            (room.allUserIds && room.allUserIds.map(id => id?.toString()).includes(userId.toString())) ||
            (room.conversationKey && room.conversationKey.includes(userId.toString()));

          if (isParticipantOrInvited) {
            const participantsList = Array.from(room.participants.values());
            socket.emit('active_call_update', {
              roomId: room.roomId,
              conversationKey: room.conversationKey,
              callerInfo: room.callerInfo,
              callType: room.callType,
              startedAt: room.startedAt,
              isActive: true,
              participantCount: room.participants.size,
              participants: participantsList,
              allUserIds: room.allUserIds || []
            });
          }
        }
      }
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

  // --- WebRTC Slack-Style Persistent Call Rooms & Multi-User Signaling ---

  const getConversationKey = (id1, id2) => {
    if (!id1 || !id2) return null;
    return [id1.toString(), id2.toString()].sort().join(':');
  };

  const broadcastCallUpdate = (room) => {
    if (!room) return;
    const participantsList = Array.from(room.participants.values());
    const payload = {
      roomId: room.roomId,
      conversationKey: room.conversationKey,
      callerInfo: room.callerInfo,
      callType: room.callType,
      startedAt: room.startedAt,
      isActive: room.participants.size > 0,
      participantCount: room.participants.size,
      participants: participantsList,
      allUserIds: room.allUserIds || []
    };

    io.to(`call_room_${room.roomId}`).emit('active_call_update', payload);

    // Global broadcast for real-time room participant counter in Schedule page
    io.emit('call_room_participant_update', {
      roomId: room.roomId,
      participantCount: room.participants.size,
      isLive: room.participants.size > 0
    });

    if (room.allUserIds && Array.isArray(room.allUserIds)) {
      room.allUserIds.forEach(uid => {
        if (uid) io.to(uid.toString()).emit('active_call_update', payload);
      });
    }
  };

  const handleUserLeavingRoom = (leavingSocket, explicitRoomId) => {
    const rId = explicitRoomId || leavingSocket.callRoomId;
    if (!rId) return;

    leavingSocket.leave(`call_room_${rId}`);
    leavingSocket.to(`call_room_${rId}`).emit('user_left_call_room', {
      socketId: leavingSocket.id,
      userId: leavingSocket.callUserInfo?.userId
    });

    const room = activeCallRooms.get(rId);
    if (room) {
      room.participants.delete(leavingSocket.id);
      console.log(`[CallRoom] Socket ${leavingSocket.id} (${leavingSocket.callUserInfo?.fullName || 'User'}) left room ${rId}. Remaining: ${room.participants.size}`);

      if (room.participants.size > 0) {
        // CALL CONTINUES FOR OTHERS (Slack style persistent call)
        broadcastCallUpdate(room);
      } else {
        // All participants have left -> End call officially
        const durationSeconds = Math.round((Date.now() - (room.startedAt || Date.now())) / 1000);
        console.log(`[CallRoom] All participants left room ${rId}. Call ended after ${durationSeconds}s`);
        const endPayload = {
          roomId: room.roomId,
          conversationKey: room.conversationKey,
          isActive: false,
          ended: true,
          durationSeconds,
          participantCount: 0,
          participants: [],
          allUserIds: room.allUserIds || []
        };

        io.to(`call_room_${rId}`).emit('active_call_update', endPayload);
        io.emit('call_room_participant_update', {
          roomId: room.roomId,
          participantCount: 0,
          isLive: false
        });
        if (room.allUserIds && Array.isArray(room.allUserIds)) {
          room.allUserIds.forEach(uid => {
            if (uid) io.to(uid.toString()).emit('active_call_update', endPayload);
          });
        }
        activeCallRooms.delete(rId);
      }
    }
    leavingSocket.callRoomId = null;
  };

  // 1. Initiate or Invite to Call Room
  socket.on('call_room_invite', ({ roomId, recipientIds, callerInfo, callType }) => {
    const list = Array.isArray(recipientIds) ? recipientIds.filter(Boolean) : [recipientIds].filter(Boolean);
    const callerId = callerInfo?.userId;
    const allUserIds = Array.from(new Set([callerId, ...list].filter(Boolean)));
    const conversationKey = (list.length === 1 && callerId) ? getConversationKey(callerId, list[0]) : `group_${roomId}`;

    console.log(`[CallRoom] Invite to room ${roomId} for:`, list, 'caller:', callerInfo?.fullName);

    // Initialize or update active room
    let room = activeCallRooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        conversationKey,
        callerInfo,
        callType: callType || 'video',
        startedAt: Date.now(),
        allUserIds: [...allUserIds],
        participants: new Map()
      };
      activeCallRooms.set(roomId, room);
    } else {
      // Append new recipients to room.allUserIds so reconnected users are recognized
      list.forEach(targetId => {
        if (targetId && !room.allUserIds.map(x => x.toString()).includes(targetId.toString())) {
          room.allUserIds.push(targetId);
        }
      });
    }

    // Notify recipients
    list.forEach(targetId => {
      io.to(targetId.toString()).emit('incoming_call_room', {
        roomId,
        callerInfo,
        callType,
        allRecipients: list,
        conversationKey
      });
    });

    broadcastCallUpdate(room);
  });

  // 2. Query Active Call for a specific chat conversation (Slack style)
  socket.on('check_active_call', ({ recipientId, myId }, callback) => {
    const convKey = getConversationKey(recipientId, myId);
    let activeRoom = null;

    for (const room of activeCallRooms.values()) {
      if (room.participants.size > 0) {
        if (room.conversationKey === convKey || (room.allUserIds && room.allUserIds.includes(recipientId) && room.allUserIds.includes(myId))) {
          activeRoom = room;
          break;
        }
      }
    }

    if (activeRoom) {
      const payload = {
        hasActiveCall: true,
        roomId: activeRoom.roomId,
        conversationKey: activeRoom.conversationKey,
        callerInfo: activeRoom.callerInfo,
        callType: activeRoom.callType,
        startedAt: activeRoom.startedAt,
        participantCount: activeRoom.participants.size,
        participants: Array.from(activeRoom.participants.values())
      };
      if (typeof callback === 'function') callback(payload);
      socket.emit('active_call_update', payload);
    } else {
      if (typeof callback === 'function') callback({ hasActiveCall: false });
    }
  });

  // Query live room participant counts for scheduled calls
  socket.on('get_live_room_counts', (callback) => {
    const counts = {};
    for (const [rId, room] of activeCallRooms.entries()) {
      if (room && room.participants) {
        counts[rId] = room.participants.size;
      }
    }
    if (typeof callback === 'function') callback(counts);
  });

  // 3. Join Call Room
  socket.on('join_call_room', ({ roomId, userInfo }) => {
    if (!roomId) return;
    socket.join(`call_room_${roomId}`);
    socket.callRoomId = roomId;
    socket.callUserInfo = userInfo;

    let room = activeCallRooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        callerInfo: userInfo,
        callType: 'video',
        startedAt: Date.now(),
        allUserIds: [userInfo?.userId].filter(Boolean),
        participants: new Map()
      };
      activeCallRooms.set(roomId, room);
    }

    room.participants.set(socket.id, {
      socketId: socket.id,
      userId: userInfo?.userId,
      fullName: userInfo?.fullName || 'Space Member',
      avatarUrl: userInfo?.avatarUrl || '',
      category: userInfo?.category || '',
      isAudioMuted: Boolean(userInfo?.isAudioMuted),
      isVideoOff: Boolean(userInfo?.isVideoOff),
      joinedAt: Date.now()
    });

    if (userInfo?.userId && !room.allUserIds.includes(userInfo.userId)) {
      room.allUserIds.push(userInfo.userId);
    }

    console.log(`[CallRoom] User ${userInfo?.fullName || socket.id} joined room ${roomId}. Total participants: ${room.participants.size}`);

    io.emit('call_room_participant_update', {
      roomId: room.roomId,
      participantCount: room.participants.size,
      isLive: true
    });

    // 1. Send all EXISTING participants in this room to the joining socket
    const existingPeers = Array.from(room.participants.values())
      .filter(p => p.socketId !== socket.id);

    socket.emit('call_room_existing_peers', {
      peers: existingPeers
    });

    // 2. Notify peers in room for WebRTC peer handshake
    socket.to(`call_room_${roomId}`).emit('user_joined_call_room', {
      socketId: socket.id,
      userId: userInfo?.userId,
      userInfo
    });

    broadcastCallUpdate(room);
  });

  // 4. WebRTC Signaling: Offer, Answer, ICE
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
      const room = activeCallRooms.get(rId);
      if (room && room.participants.has(socket.id)) {
        const p = room.participants.get(socket.id);
        if (isAudioMuted !== undefined) p.isAudioMuted = isAudioMuted;
        if (isVideoOff !== undefined) p.isVideoOff = isVideoOff;
      }

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
    handleUserLeavingRoom(socket, roomId);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
    handleUserLeavingRoom(socket);
  });
});

app.get('/', (req, res) => {
  res.send('ITV CMS API is running...');
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
