const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CommunityMessage = require('../models/CommunityMessage');
const ScheduledCall = require('../models/ScheduledCall');
const auth = require('../middleware/auth');

// Utility helper to check if user has an active ITV Web subscription
const hasActiveWebSubscription = (user) => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superAdmin') return true;
  if (!user.activePlans || !Array.isArray(user.activePlans)) return false;
  const now = new Date();
  return user.activePlans.some(plan => !plan.expiryDate || new Date(plan.expiryDate) > now);
};

// @route   GET /api/community/me
// @desc    Get current user community profile & status
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const isSubscribed = hasActiveWebSubscription(user);
    res.json({
      user,
      isSubscribed,
      verificationStatus: user.verificationStatus || 'unsubmitted',
      verificationBadge: user.verificationBadge || 'none',
      communityProfile: user.communityProfile || {},
      communitySubscription: user.communitySubscription || { tier: 'free', unlockedMembers: [] }
    });
  } catch (err) {
    console.error('Error in /api/community/me:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/community/profile
// @desc    Update profile details & submit for manual verification
// @access  Private
router.post('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (!hasActiveWebSubscription(user)) {
      return res.status(403).json({ msg: 'Active Interplanetary subscription required' });
    }

    const {
      fullName,
      bio,
      category,
      location,
      avatarUrl,
      coverUrl,
      linkedinUrl,
      additionalLinks,
      workExperience,
      education,
      skills,
      certificates,
      businessDetails,
      interests,
      verificationDocs,
      submitForVerification
    } = req.body;

    user.communityProfile = {
      fullName: fullName || user.username || user.email.split('@')[0],
      bio: bio || '',
      category: category || 'enthusiast',
      location: location || '',
      avatarUrl: avatarUrl || '',
      coverUrl: coverUrl || '',
      linkedinUrl: linkedinUrl || '',
      additionalLinks: Array.isArray(additionalLinks) ? additionalLinks : [],
      workExperience: Array.isArray(workExperience) ? workExperience : [],
      education: Array.isArray(education) ? education : [],
      skills: Array.isArray(skills) ? skills : [],
      certificates: Array.isArray(certificates) ? certificates : [],
      businessDetails: businessDetails || {},
      interests: Array.isArray(interests) ? interests : []
    };

    if (verificationDocs) {
      user.verificationDocs = {
        idDocumentUrl: verificationDocs.idDocumentUrl || '',
        docType: verificationDocs.docType || 'ID Document',
        legalName: verificationDocs.legalName || fullName || '',
        address: verificationDocs.address || '',
        submittedAt: new Date()
      };
    }

    if (submitForVerification) {
      user.verificationStatus = 'pending';
    }

    await user.save();

    res.json({
      msg: submitForVerification ? 'Profile submitted for verification successfully' : 'Profile updated',
      user: {
        id: user._id,
        verificationStatus: user.verificationStatus,
        verificationBadge: user.verificationBadge,
        communityProfile: user.communityProfile,
        verificationDocs: user.verificationDocs
      }
    });
  } catch (err) {
    console.error('Error saving community profile:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// @route   GET /api/community/members
// @desc    Get members directory (ONLY verified profiles, excluding blocked users)
// @access  Private
router.get('/members', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    if (!hasActiveWebSubscription(currentUser)) {
      return res.status(403).json({ msg: 'Active Interplanetary subscription required to access community' });
    }

    const isCurrentVerified = currentUser.verificationStatus === 'verified';
    const { category, search } = req.query;

    const myBlocked = currentUser.blockedUsers || [];

    // Query ONLY verified profiles, excluding blocked users
    let query = { 
      _id: { $ne: currentUser._id, $nin: myBlocked },
      blockedUsers: { $ne: currentUser._id },
      verificationStatus: 'verified' 
    };

    const members = await User.find(query).select('-password -stripeCustomerId -twoFactorCode -resetPasswordOTP');

    const filteredMembers = members.map(member => {
      const mProfile = member.communityProfile || {};

      const basicInfo = {
        _id: member._id,
        username: member.username || mProfile.fullName || 'Space Member',
        fullName: mProfile.fullName || member.username || 'Space Member',
        avatarUrl: mProfile.avatarUrl || '',
        category: mProfile.category || 'enthusiast',
        verificationBadge: member.verificationBadge || 'none',
        verificationStatus: member.verificationStatus || 'verified'
      };

      if (!isCurrentVerified) {
        return {
          ...basicInfo,
          isLocked: true,
          lockReason: 'Verify your profile to unlock member details'
        };
      }

      return {
        ...basicInfo,
        bio: mProfile.bio || '',
        location: mProfile.location || '',
        coverUrl: mProfile.coverUrl || '',
        linkedinUrl: mProfile.linkedinUrl || '',
        additionalLinks: mProfile.additionalLinks || [],
        workExperience: mProfile.workExperience || [],
        education: mProfile.education || [],
        skills: mProfile.skills || [],
        certificates: mProfile.certificates || [],
        businessDetails: mProfile.businessDetails || {},
        interests: mProfile.interests || [],
        isLocked: false
      };
    });

    let result = filteredMembers;
    if (category && category !== 'all') {
      result = result.filter(m => m.category === category || m.verificationBadge === category);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m => 
        (m.fullName && m.fullName.toLowerCase().includes(q)) || 
        (m.username && m.username.toLowerCase().includes(q)) ||
        (m.skills && m.skills.some(s => s.toLowerCase().includes(q)))
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching community members:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/community/members/:id
// @desc    Get single member full profile (privacy filtered)
// @access  Private
router.get('/members/:id', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetMember = await User.findById(req.params.id).select('-password');
    if (!targetMember) return res.status(404).json({ msg: 'Member not found' });

    const isBlockedByMe = (currentUser.blockedUsers || []).map(id => id.toString()).includes(targetMember._id.toString());
    const isBlockedByTarget = (targetMember.blockedUsers || []).map(id => id.toString()).includes(currentUser._id.toString());

    const isCurrentVerified = currentUser.verificationStatus === 'verified';
    const mProfile = targetMember.communityProfile || {};

    const basicInfo = {
      _id: targetMember._id,
      username: targetMember.username || mProfile.fullName || 'Space Member',
      fullName: mProfile.fullName || targetMember.username || 'Space Member',
      avatarUrl: mProfile.avatarUrl || '',
      category: mProfile.category || 'enthusiast',
      verificationBadge: targetMember.verificationBadge || 'none',
      verificationStatus: targetMember.verificationStatus || 'unsubmitted',
      isBlockedByMe,
      isBlockedByTarget
    };

    if (!isCurrentVerified) {
      return res.json({
        ...basicInfo,
        isLocked: true,
        lockReason: 'Complete & verify your profile to unlock member details'
      });
    }

    res.json({
      ...basicInfo,
      bio: mProfile.bio || '',
      location: mProfile.location || '',
      coverUrl: mProfile.coverUrl || '',
      linkedinUrl: mProfile.linkedinUrl || '',
      additionalLinks: mProfile.additionalLinks || [],
      workExperience: mProfile.workExperience || [],
      education: mProfile.education || [],
      skills: mProfile.skills || [],
      certificates: mProfile.certificates || [],
      businessDetails: mProfile.businessDetails || {},
      interests: mProfile.interests || [],
      isLocked: false,
      communityTier: currentUser.communitySubscription?.tier || 'free'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/community/conversations
// @desc    Get all active conversation partners for current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const msgs = await CommunityMessage.find({
      $or: [{ sender: userId }, { recipient: userId }]
    }).sort({ createdAt: -1 });

    const partnerIds = new Set();
    const latestMsgsMap = {};

    msgs.forEach(m => {
      const partnerId = m.sender.toString() === userId.toString() ? m.recipient.toString() : m.sender.toString();
      if (!partnerIds.has(partnerId)) {
        partnerIds.add(partnerId);
        latestMsgsMap[partnerId] = m;
      }
    });

    const partners = await User.find({ _id: { $in: Array.from(partnerIds) } }).select('-password');

    const conversations = partners.map(p => {
      const lastMsg = latestMsgsMap[p._id.toString()];
      const mProfile = p.communityProfile || {};
      return {
        _id: p._id,
        fullName: mProfile.fullName || p.username || 'Space Member',
        avatarUrl: mProfile.avatarUrl || '',
        category: mProfile.category || 'enthusiast',
        verificationBadge: p.verificationBadge || 'none',
        lastMessage: lastMsg ? lastMsg.content : '',
        lastMessageTime: lastMsg ? lastMsg.createdAt : null
      };
    });

    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/community/block/:targetUserId
// @desc    Block a user
// @access  Private
router.post('/block/:targetUserId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const targetId = req.params.targetUserId;

    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(targetId)) {
      user.blockedUsers.push(targetId);
      await user.save();
    }

    res.json({ msg: 'User blocked successfully', blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/community/unblock/:targetUserId
// @desc    Unblock a user
// @access  Private
router.post('/unblock/:targetUserId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const targetId = req.params.targetUserId;

    if (user.blockedUsers) {
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetId.toString());
      await user.save();
    }

    res.json({ msg: 'User unblocked successfully', blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/community/notifications
// @desc    Get user notifications
// @access  Private
router.get('/notifications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const notifications = user.notifications || [];
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/community/notifications/mark-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/notifications/mark-read', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (user.notifications) {
      user.notifications.forEach(n => { n.read = true; });
      await user.save();
    }

    res.json({ msg: 'Notifications marked as read', notifications: user.notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/community/messages/:recipientId
// @desc    Get chat message thread
// @access  Private
router.get('/messages/:recipientId', auth, async (req, res) => {
  try {
    const messages = await CommunityMessage.find({
      $or: [
        { sender: req.user.id, recipient: req.params.recipientId },
        { sender: req.params.recipientId, recipient: req.user.id }
      ]
    })
      .populate('scheduledCallId')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/community/messages
// @desc    Send a message or call log
// @access  Private
router.post('/messages', auth, async (req, res) => {
  try {
    const { recipientId, content, type, callDurationSeconds } = req.body;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) return res.status(404).json({ msg: 'Recipient user not found' });

    // Block checks
    const myBlocked = currentUser.blockedUsers || [];
    const recipientBlocked = recipientUser.blockedUsers || [];

    if (myBlocked.map(id => id.toString()).includes(recipientId.toString())) {
      return res.status(403).json({ msg: 'You have blocked this member. Unblock to send messages.' });
    }
    if (recipientBlocked.map(id => id.toString()).includes(currentUser._id.toString())) {
      return res.status(403).json({ msg: 'This member has blocked messages/calls from your account.' });
    }

    if (currentUser.verificationStatus !== 'verified') {
      return res.status(403).json({ msg: 'Only verified members can send messages or make calls.' });
    }

    const hasWebPlan = hasActiveWebSubscription(currentUser);
    const tier = currentUser.communitySubscription?.tier || 'free';
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superAdmin';

    if (!isAdmin && (!hasWebPlan || tier === 'free')) {
      return res.status(403).json({ 
        msg: 'Private messaging and calls require an active ITV plan and a Community subscription tier. Please upgrade to connect.',
        requiresPlanUpgrade: true 
      });
    }

    const newMsg = new CommunityMessage({
      sender: req.user.id,
      recipient: recipientId,
      content: content || (type === 'audio_call' ? 'Audio Call' : type === 'video_call' ? 'Video Call' : ''),
      type: type || 'text',
      callDurationSeconds: callDurationSeconds || 0
    });

    await newMsg.save();

    // Push notification to recipient
    if (!recipientUser.notifications) recipientUser.notifications = [];
    recipientUser.notifications.push({
      title: `New message from ${currentUser.communityProfile?.fullName || currentUser.username}`,
      message: content.length > 60 ? content.substring(0, 60) + '...' : content,
      type: 'chat',
      link: `/messages?recipient=${currentUser._id}`,
      read: false,
      createdAt: new Date()
    });
    await recipientUser.save();

    res.json(newMsg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/community/subscribe
// @desc    Upgrade Community Plan (Basic, Plus, Pro)
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['basic', 'plus', 'pro'].includes(tier)) {
      return res.status(400).json({ msg: 'Invalid tier selection' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    user.communitySubscription = {
      tier,
      expiryDate,
      unlockedMembers: user.communitySubscription?.unlockedMembers || []
    };

    await user.save();

    res.json({
      msg: `Successfully subscribed to Community ${tier.toUpperCase()} Plan!`,
      communitySubscription: user.communitySubscription
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// --- SCHEDULED CALLS (MEETINGS) ENDPOINTS ---

// @route   POST /api/community/scheduled-calls
// @desc    Schedule a new audio/video call with participants
// @access  Private
router.post('/scheduled-calls', auth, async (req, res) => {
  try {
    const { title, description, callType, scheduledAt, durationMinutes, participantIds } = req.body;
    if (!title || !scheduledAt) {
      return res.status(400).json({ msg: 'Title and scheduled time are required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ msg: 'Invalid scheduled date' });
    }

    // Must be in the future (with 1-min buffer for network transmission)
    if (scheduledDate.getTime() < Date.now() - 60000) {
      return res.status(400).json({ msg: 'Meetings can only be scheduled for a future date and time' });
    }

    const hostUser = await User.findById(req.user.id);
    if (!hostUser) return res.status(404).json({ msg: 'User not found' });

    const roomId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const validParticipantIds = Array.isArray(participantIds) ? participantIds.filter(id => id && id.toString() !== req.user.id.toString()) : [];

    const newCall = new ScheduledCall({
      title,
      description: description || '',
      callType: callType === 'audio' ? 'audio' : 'video',
      scheduledAt: scheduledDate,
      durationMinutes: durationMinutes || 30,
      host: req.user.id,
      participants: validParticipantIds,
      roomId,
      status: 'scheduled'
    });

    await newCall.save();
    await newCall.populate('host', 'username communityProfile');
    await newCall.populate('participants', 'username communityProfile');

    // Send in-app notification to each participant (without flooding chat messages)
    const hostName = hostUser.communityProfile?.fullName || hostUser.username;
    const formattedDate = new Date(scheduledAt).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    for (const pId of validParticipantIds) {
      try {
        const pUser = await User.findById(pId);
        if (pUser) {
          if (!pUser.notifications) pUser.notifications = [];
          pUser.notifications.push({
            title: `New Meeting: ${title}`,
            message: `Scheduled by ${hostName} for ${formattedDate}`,
            type: 'meeting',
            link: `/schedule`,
            read: false,
            createdAt: new Date()
          });
          await pUser.save();
        }
      } catch (errMsg) {
        console.warn('Error sending automated notification:', errMsg);
      }
    }

    res.json(newCall);
  } catch (err) {
    console.error('Error creating scheduled call:', err);
    res.status(500).json({ msg: 'Server error creating scheduled call' });
  }
});

// @route   GET /api/community/scheduled-calls
// @desc    Get all scheduled calls for current user with live participant count
// @access  Private
router.get('/scheduled-calls', auth, async (req, res) => {
  try {
    const calls = await ScheduledCall.find({
      $or: [
        { host: req.user.id },
        { participants: req.user.id }
      ]
    })
      .populate('host', 'username communityProfile')
      .populate('participants', 'username communityProfile')
      .sort({ scheduledAt: 1 });

    const activeCallRooms = global.activeCallRooms || new Map();
    const enrichedCalls = calls.map(c => {
      const callObj = c.toObject();
      const room = activeCallRooms.get(c.roomId);
      callObj.liveParticipantCount = room && room.participants ? room.participants.size : 0;
      callObj.isLive = callObj.liveParticipantCount > 0;
      return callObj;
    });

    res.json(enrichedCalls);
  } catch (err) {
    console.error('Error fetching scheduled calls:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/community/scheduled-calls/:id
// @desc    Cancel/Delete a scheduled call (host only)
// @access  Private
router.delete('/scheduled-calls/:id', auth, async (req, res) => {
  try {
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) return res.status(404).json({ msg: 'Scheduled call not found' });

    if (call.host.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Not authorized to cancel this call' });
    }

    call.status = 'cancelled';
    await call.save();
    res.json({ msg: 'Call cancelled successfully', call });
  } catch (err) {
    console.error('Error cancelling scheduled call:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/community/scheduled-calls/:id
// @desc    Update / Edit a scheduled call (host or admin only)
// @access  Private
router.put('/scheduled-calls/:id', auth, async (req, res) => {
  try {
    const { title, description, callType, scheduledAt, durationMinutes, participantIds } = req.body;
    
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) return res.status(404).json({ msg: 'Scheduled call not found' });

    if (call.host.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Only the meeting host can edit this meeting' });
    }

    if (title) call.title = title.trim();
    if (description !== undefined) call.description = description.trim();
    if (callType && ['video', 'audio'].includes(callType)) call.callType = callType;

    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ msg: 'Invalid scheduled date' });
      }
      if (scheduledDate.getTime() < Date.now() - 60000) {
        return res.status(400).json({ msg: 'Meetings can only be scheduled for a future date and time' });
      }
      call.scheduledAt = scheduledDate;
    }

    if (durationMinutes && !isNaN(durationMinutes)) {
      call.durationMinutes = Math.max(15, Number(durationMinutes));
    }

    if (Array.isArray(participantIds)) {
      call.participants = participantIds.filter(id => id && id.toString() !== call.host.toString());
    }

    await call.save();
    await call.populate('host', 'username communityProfile');
    await call.populate('participants', 'username communityProfile');

    res.json(call);
  } catch (err) {
    console.error('Error updating scheduled call:', err);
    res.status(500).json({ msg: 'Server error updating scheduled call' });
  }
});

// @route   PUT /api/community/scheduled-calls/:id/status
// @desc    Update call status (active / completed)
// @access  Private
router.put('/scheduled-calls/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const call = await ScheduledCall.findById(req.params.id);
    if (!call) return res.status(404).json({ msg: 'Scheduled call not found' });

    call.status = status;
    await call.save();
    res.json(call);
  } catch (err) {
    console.error('Error updating call status:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/community/check-availability
// @desc    Check which community members have conflicting meetings for a given time window
// @access  Private
router.post('/check-availability', auth, async (req, res) => {
  try {
    const { start, end, excludeCallId } = req.body;
    if (!start || !end) {
      return res.status(400).json({ msg: 'Start and end times are required' });
    }

    const windowStart = new Date(start);
    const windowEnd = new Date(end);

    // Find all active or scheduled calls that overlap with [windowStart, windowEnd]
    const query = {
      status: { $in: ['scheduled', 'active'] },
      scheduledAt: { $lt: windowEnd }
    };
    if (excludeCallId) {
      query._id = { $ne: excludeCallId };
    }

    const potentialCollisions = await ScheduledCall.find(query);

    const busyUserIds = new Set();
    potentialCollisions.forEach(call => {
      const callStart = new Date(call.scheduledAt);
      const callEnd = new Date(callStart.getTime() + (call.durationMinutes || 30) * 60000);

      // Overlap condition: callStart < windowEnd && callEnd > windowStart
      if (callStart < windowEnd && callEnd > windowStart) {
        if (call.host) busyUserIds.add(call.host.toString());
        if (Array.isArray(call.participants)) {
          call.participants.forEach(p => {
            if (p) busyUserIds.add(p.toString());
          });
        }
      }
    });

    res.json({ busyUserIds: Array.from(busyUserIds) });
  } catch (err) {
    console.error('Error checking availability:', err);
    res.status(500).json({ msg: 'Server error checking availability' });
  }
});

module.exports = router;
