const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CommunityMessage = require('../models/CommunityMessage');
const ScheduledCall = require('../models/ScheduledCall');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');

// Utility helper to check if user has an active ITV Web subscription
const hasActiveWebSubscription = (user) => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superAdmin') return true;
  if (!user.activePlans || !Array.isArray(user.activePlans)) return false;
  const now = new Date();
  return user.activePlans.some(plan => !plan.expiryDate || new Date(plan.expiryDate) > now);
};

// Utility helper to check if user has ANY active plan (Web plan or Community plan)
const hasAnyActivePlan = (user) => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superAdmin') return true;
  if (user.communitySubscription && user.communitySubscription.tier && user.communitySubscription.tier !== 'free') {
    if (!user.communitySubscription.expiryDate || new Date(user.communitySubscription.expiryDate) > new Date()) {
      return true;
    }
  }
  return hasActiveWebSubscription(user);
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

// --- FRIEND REQUESTS & FRIENDSHIP ENDPOINTS ---

// @route   GET /api/community/friends
// @desc    Get user's accepted friends, pending sent, and pending received requests
// @access  Private
router.get('/friends', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendships = await Friendship.find({
      $or: [{ requester: currentUserId }, { recipient: currentUserId }]
    })
      .populate('requester', 'username email verificationBadge verificationStatus communityProfile')
      .populate('recipient', 'username email verificationBadge verificationStatus communityProfile')
      .sort({ updatedAt: -1 });

    const friends = [];
    const pendingReceived = [];
    const pendingSent = [];

    friendships.forEach(f => {
      if (!f.requester || !f.recipient) return;
      const isRequester = f.requester._id.toString() === currentUserId.toString();
      const otherUser = isRequester ? f.recipient : f.requester;
      if (!otherUser) return;

      const userSummary = {
        _id: otherUser._id,
        username: otherUser.username || otherUser.communityProfile?.fullName || 'Space Member',
        fullName: otherUser.communityProfile?.fullName || otherUser.username || 'Space Member',
        avatarUrl: otherUser.communityProfile?.avatarUrl || '',
        category: otherUser.communityProfile?.category || 'enthusiast',
        verificationBadge: otherUser.verificationBadge || 'none',
        friendshipId: f._id,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      };

      if (f.status === 'accepted') {
        friends.push(userSummary);
      } else if (f.status === 'pending') {
        if (isRequester) {
          pendingSent.push(userSummary);
        } else {
          pendingReceived.push(userSummary);
        }
      }
    });

    res.json({
      friends,
      pendingReceived,
      pendingSent,
      totalFriends: friends.length,
      pendingReceivedCount: pendingReceived.length
    });
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ msg: 'Server error fetching friends' });
  }
});

// @route   GET /api/community/friends/status/:targetUserId
// @desc    Check friendship status with a target user
// @access  Private
router.get('/friends/status/:targetUserId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.targetUserId;

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.json({ status: 'self' });
    }

    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: targetUserId },
        { requester: targetUserId, recipient: currentUserId }
      ]
    });

    if (!friendship) {
      return res.json({ status: 'none' });
    }

    if (friendship.status === 'accepted') {
      return res.json({ status: 'friends', friendshipId: friendship._id });
    }

    if (friendship.status === 'pending') {
      if (friendship.requester.toString() === currentUserId.toString()) {
        return res.json({ status: 'pending_sent', friendshipId: friendship._id });
      } else {
        return res.json({ status: 'pending_received', friendshipId: friendship._id });
      }
    }

    res.json({ status: 'none', friendshipId: friendship._id });
  } catch (err) {
    console.error('Error checking friendship status:', err);
    res.status(500).json({ msg: 'Server error checking friendship status' });
  }
});

// @route   POST /api/community/friends/request/:recipientId
// @desc    Send a friend request (requires any active plan)
// @access  Private
router.post('/friends/request/:recipientId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    const recipientId = req.params.recipientId;
    if (currentUser._id.toString() === recipientId.toString()) {
      return res.status(400).json({ msg: 'You cannot send a friend request to yourself' });
    }

    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) return res.status(404).json({ msg: 'Recipient user not found' });

    // Plan requirement: Must have any active plan (web plan or community plan) or be admin
    if (!hasAnyActivePlan(currentUser)) {
      return res.status(403).json({
        msg: 'You must have an active subscription plan to send friend requests. Please subscribe or upgrade your plan to connect.',
        requiresPlan: true
      });
    }

    // Check block list
    const myBlocked = currentUser.blockedUsers || [];
    const recipientBlocked = recipientUser.blockedUsers || [];
    if (myBlocked.map(id => id.toString()).includes(recipientId.toString())) {
      return res.status(403).json({ msg: 'You have blocked this member. Unblock to send a friend request.' });
    }
    if (recipientBlocked.map(id => id.toString()).includes(currentUser._id.toString())) {
      return res.status(403).json({ msg: 'This member has blocked interaction with your account.' });
    }

    let existing = await Friendship.findOne({
      $or: [
        { requester: currentUser._id, recipient: recipientId },
        { requester: recipientId, recipient: currentUser._id }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ msg: 'You are already friends with this member', status: 'friends' });
      }
      if (existing.status === 'pending') {
        if (existing.requester.toString() === currentUser._id.toString()) {
          return res.status(400).json({ msg: 'Friend request already sent and pending', status: 'pending_sent' });
        } else {
          // Target had already sent request to current user, so accept it!
          existing.status = 'accepted';
          existing.updatedAt = new Date();
          await existing.save();

          // Notify recipient (the other user)
          if (!recipientUser.notifications) recipientUser.notifications = [];
          recipientUser.notifications.push({
            title: 'Friend Request Accepted! 🚀',
            message: `${currentUser.communityProfile?.fullName || currentUser.username} accepted your friend request. You can now make voice and video calls!`,
            type: 'friend_request',
            link: `/?recipient=${currentUser._id}`,
            read: false,
            createdAt: new Date()
          });
          await recipientUser.save();

          return res.json({ msg: 'Friend request accepted! You are now friends.', status: 'friends', friendship: existing });
        }
      }
      // If rejected, re-open request
      existing.requester = currentUser._id;
      existing.recipient = recipientId;
      existing.status = 'pending';
      existing.updatedAt = new Date();
      await existing.save();
    } else {
      existing = new Friendship({
        requester: currentUser._id,
        recipient: recipientId,
        status: 'pending'
      });
      await existing.save();
    }

    // Push notification to recipient
    if (!recipientUser.notifications) recipientUser.notifications = [];
    recipientUser.notifications.push({
      title: 'New Friend Request 🤝',
      message: `${currentUser.communityProfile?.fullName || currentUser.username} sent you a friend request.`,
      type: 'friend_request',
      link: `/?recipient=${currentUser._id}`,
      read: false,
      createdAt: new Date()
    });
    await recipientUser.save();

    res.json({
      msg: 'Friend request sent successfully!',
      status: 'pending_sent',
      friendship: existing
    });
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.status(500).json({ msg: 'Server error sending friend request' });
  }
});

// @route   PUT /api/community/friends/respond/:friendshipId
// @desc    Accept or reject a friend request
// @access  Private
router.put('/friends/respond/:friendshipId', auth, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ msg: 'Invalid action. Must be accept or reject.' });
    }

    const friendship = await Friendship.findById(req.params.friendshipId);
    if (!friendship) return res.status(404).json({ msg: 'Friend request not found' });

    // Only the recipient can accept or reject
    if (friendship.recipient.toString() !== req.user.id.toString()) {
      return res.status(403).json({ msg: 'Only the recipient can respond to this friend request' });
    }

    const recipientUser = await User.findById(req.user.id);
    const requesterUser = await User.findById(friendship.requester);

    if (action === 'accept') {
      friendship.status = 'accepted';
      friendship.updatedAt = new Date();
      await friendship.save();

      // Send notification to requester
      if (requesterUser) {
        if (!requesterUser.notifications) requesterUser.notifications = [];
        requesterUser.notifications.push({
          title: 'Friend Request Accepted! 🚀',
          message: `${recipientUser?.communityProfile?.fullName || recipientUser?.username || 'A member'} accepted your friend request. You can now start voice and video calls!`,
          type: 'friend_request',
          link: `/?recipient=${recipientUser?._id}`,
          read: false,
          createdAt: new Date()
        });
        await requesterUser.save();
      }

      res.json({ msg: 'Friend request accepted! You are now friends.', status: 'friends', friendship });
    } else {
      friendship.status = 'rejected';
      friendship.updatedAt = new Date();
      await friendship.save();

      res.json({ msg: 'Friend request declined.', status: 'none', friendship });
    }
  } catch (err) {
    console.error('Error responding to friend request:', err);
    res.status(500).json({ msg: 'Server error responding to friend request' });
  }
});

// @route   DELETE /api/community/friends/:friendshipId
// @desc    Cancel a friend request or unfriend
// @access  Private
router.delete('/friends/:friendshipId', auth, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.friendshipId);
    if (!friendship) return res.status(404).json({ msg: 'Friendship record not found' });

    // Must be either requester or recipient
    const userId = req.user.id.toString();
    if (friendship.requester.toString() !== userId && friendship.recipient.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to remove this connection' });
    }

    await Friendship.findByIdAndDelete(req.params.friendshipId);
    res.json({ msg: 'Friend connection removed successfully', status: 'none' });
  } catch (err) {
    console.error('Error removing friendship:', err);
    res.status(500).json({ msg: 'Server error removing friendship' });
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

    // All messaging and calls strictly require an accepted friendship
    const isFriend = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requester: currentUser._id, recipient: recipientUser._id },
        { requester: recipientUser._id, recipient: currentUser._id }
      ]
    });
    if (!isAdmin && !isFriend) {
      return res.status(403).json({
        msg: 'Chat and calls are disabled until your friend request is approved. Please connect as friends first.',
        requiresFriendship: true
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
// @desc    Upgrade Community Plan (Space Enthusiast, Space Professional, Space Entrepreneur)
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { tier } = req.body;
    const validTiers = ['enthusiast', 'professional', 'entrepreneur', 'basic', 'plus', 'pro'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ msg: 'Invalid tier selection' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const badgeHierarchy = {
      none: 0,
      enthusiast: 1,
      professional: 2,
      entrepreneur: 3
    };

    const tierRequiredLevel = {
      enthusiast: 1,
      professional: 2,
      entrepreneur: 3,
      basic: 1,
      plus: 2,
      pro: 3
    };

    const userBadge = user.verificationBadge || 'none';
    const userBadgeLevel = badgeHierarchy[userBadge] || 0;
    const requiredLevel = tierRequiredLevel[tier] || 1;
    // Verification Badge check: User can only purchase plans up to their verification badge level
    if (user.verificationStatus !== 'verified' || userBadgeLevel === 0) {
      return res.status(403).json({
        msg: 'You must first submit your credentials and obtain an officially verified badge before subscribing to a community plan.',
        requiresVerification: true
      });
    }

    if (userBadgeLevel < requiredLevel) {
      const tierDisplayNames = {
        enthusiast: 'Space Enthusiast',
        professional: 'Space Professional',
        entrepreneur: 'Space Entrepreneur'
      };
      return res.status(403).json({
        msg: `Your current verified badge is ${userBadge.toUpperCase()}. To subscribe to ${tierDisplayNames[tier] || tier}, you must be verified as at least ${tierDisplayNames[tier] || tier}.`,
        userBadge,
        requiredTier: tier
      });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    user.communitySubscription = {
      tier,
      expiryDate,
      unlockedMembers: user.communitySubscription?.unlockedMembers || []
    };

    await user.save();

    const planDisplayNames = {
      enthusiast: 'Space Enthusiast (€1.99 + VAT)',
      professional: 'Space Professional (€9.99 + VAT)',
      entrepreneur: 'Space Entrepreneur (€19.99 + VAT)'
    };

    res.json({
      msg: `Successfully subscribed to ${planDisplayNames[tier] || tier.toUpperCase()} Plan!`,
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

// @route   PUT /api/community/scheduled-calls/:id/cancel
// @desc    Cancel an upcoming scheduled call (host or admin only)
// @access  Private
router.put('/scheduled-calls/:id/cancel', auth, async (req, res) => {
  try {
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) return res.status(404).json({ msg: 'Scheduled call not found' });

    if (call.host.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Only the meeting host can cancel this call' });
    }

    call.status = 'cancelled';
    await call.save();
    res.json({ msg: 'Call cancelled successfully', call });
  } catch (err) {
    console.error('Error cancelling scheduled call:', err);
    res.status(500).json({ msg: 'Server error cancelling call' });
  }
});

// @route   DELETE /api/community/scheduled-calls/:id
// @desc    Permanently delete a scheduled call from database (host or admin only)
//          Upcoming meetings cannot be deleted directly; they must be cancelled first!
// @access  Private
router.delete('/scheduled-calls/:id', auth, async (req, res) => {
  try {
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) return res.status(404).json({ msg: 'Scheduled call not found' });

    if (call.host.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Only the meeting host can delete this call' });
    }

    // Check if the meeting is upcoming and not yet cancelled
    const now = new Date();
    const callEndDate = new Date(new Date(call.scheduledAt).getTime() + (call.durationMinutes || 30) * 60000);
    const isUpcoming = call.status !== 'cancelled' && callEndDate >= now;

    if (isUpcoming) {
      return res.status(400).json({ 
        msg: 'Upcoming meetings cannot be directly deleted. Please cancel the meeting first.' 
      });
    }

    // Permanently remove from database
    await ScheduledCall.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Meeting permanently removed from database', id: req.params.id });
  } catch (err) {
    console.error('Error deleting scheduled call:', err);
    res.status(500).json({ msg: 'Server error deleting scheduled call' });
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
