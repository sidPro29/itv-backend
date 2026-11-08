const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const { 
  notifyNewTicketMessage, 
  handleTelegramWebhook 
} = require('../services/telegramSupport');

// Optional Auth Middleware (extracts user if valid token present, otherwise proceeds as guest)
const optionalAuth = async (req, res, next) => {
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded.user || decoded;
  } catch (err) {
    // Invalid token, proceed as guest
  }
  next();
};

/**
 * @route   POST /api/support/message
 * @desc    Send a support message from website user
 */
router.post('/message', optionalAuth, async (req, res) => {
  try {
    const { 
      ticketId, 
      ticketNumber, 
      guestSessionId, 
      text, 
      userName, 
      userEmail, 
      userPlatform 
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ msg: 'Message text is required' });
    }

    let ticket = null;

    // 1. Try to find existing ticket
    if (ticketId) {
      ticket = await SupportTicket.findById(ticketId);
    } else if (ticketNumber) {
      ticket = await SupportTicket.findOne({ ticketNumber });
    }

    // 2. If no ticket, try to find an open active ticket for this user / guest session
    if (!ticket) {
      if (req.user?.id) {
        ticket = await SupportTicket.findOne({
          userId: req.user.id,
          status: { $in: ['open', 'in_progress'] }
        }).sort({ updatedAt: -1 });
      } else if (guestSessionId) {
        ticket = await SupportTicket.findOne({
          guestSessionId,
          status: { $in: ['open', 'in_progress'] }
        }).sort({ updatedAt: -1 });
      }
    }

    let authorName = userName || 'Guest';
    let authorEmail = userEmail || '';

    if (req.user?.id) {
      try {
        const userObj = await User.findById(req.user.id);
        if (userObj) {
          authorName = userObj.communityProfile?.fullName || userObj.username || authorName;
          authorEmail = userObj.email || authorEmail;
        }
      } catch (e) {}
    }

    // 3. Create new ticket if none active
    if (!ticket) {
      const generatedNumber = `ITV-${Math.floor(1000 + Math.random() * 9000)}`;
      ticket = new SupportTicket({
        ticketNumber: generatedNumber,
        userId: req.user?.id || null,
        guestSessionId: guestSessionId || null,
        userName: authorName,
        userEmail: authorEmail,
        userPlatform: userPlatform || 'community',
        status: 'open',
        messages: []
      });
    }

    // Append user message
    ticket.messages.push({
      sender: 'user',
      senderName: authorName,
      text: text.trim(),
      timestamp: new Date()
    });

    ticket.status = 'open';
    if (authorName && (!ticket.userName || ticket.userName === 'Guest')) {
      ticket.userName = authorName;
    }
    if (authorEmail && !ticket.userEmail) {
      ticket.userEmail = authorEmail;
    }

    await ticket.save();

    // Notify Telegram channel & admin asynchronously
    notifyNewTicketMessage(ticket, text.trim()).catch(err => {
      console.error('[TelegramSupport] Notification error:', err);
    });

    // Realtime broadcast to user's socket room
    const io = req.app.get('io');
    if (io) {
      io.to(`support_${ticket._id}`).emit('support_user_message', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        message: ticket.messages[ticket.messages.length - 1]
      });
    }

    res.json({
      success: true,
      ticket
    });
  } catch (err) {
    console.error('Error sending support message:', err);
    res.status(500).json({ msg: 'Server error sending support message' });
  }
});

/**
 * @route   GET /api/support/ticket/:id
 * @desc    Fetch ticket conversation history
 */
router.get('/ticket/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let ticket = null;
    if (id.startsWith('ITV-')) {
      ticket = await SupportTicket.findOne({ ticketNumber: id });
    } else {
      ticket = await SupportTicket.findById(id);
    }

    if (!ticket) {
      return res.status(404).json({ msg: 'Support ticket not found' });
    }

    res.json(ticket);
  } catch (err) {
    console.error('Error fetching support ticket:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   GET /api/support/my-active
 * @desc    Get active support ticket for current user or guest
 */
router.get('/my-active', optionalAuth, async (req, res) => {
  try {
    const { guestSessionId } = req.query;
    let query = null;

    if (req.user?.id) {
      query = { userId: req.user.id, status: { $in: ['open', 'in_progress'] } };
    } else if (guestSessionId) {
      query = { guestSessionId, status: { $in: ['open', 'in_progress'] } };
    }

    if (!query) {
      return res.json({ ticket: null });
    }

    const ticket = await SupportTicket.findOne(query).sort({ updatedAt: -1 });
    res.json({ ticket });
  } catch (err) {
    console.error('Error fetching active ticket:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST /api/support/telegram-webhook
 * @desc    Incoming webhook called by Telegram when admin replies to support ticket
 */
router.post('/telegram-webhook', async (req, res) => {
  try {
    const update = req.body;
    const io = req.app.get('io');
    
    // Process update asynchronously so Telegram gets HTTP 200 immediately
    handleTelegramWebhook(update, io).catch(err => {
      console.error('[TelegramSupport] Webhook processing error:', err);
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[TelegramSupport] Webhook endpoint error:', err);
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
