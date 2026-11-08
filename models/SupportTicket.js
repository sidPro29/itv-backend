const mongoose = require('mongoose');

const SupportMessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'support'],
    required: true
  },
  senderName: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const SupportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  guestSessionId: {
    type: String,
    default: null
  },
  userName: {
    type: String,
    default: 'Community Member'
  },
  userEmail: {
    type: String,
    default: ''
  },
  userPlatform: {
    type: String,
    default: 'community' // 'community' | 'web' | 'mobile' | 'tv'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  // Mapping Telegram Message IDs so replies are routed directly to this ticket
  telegramMessages: [{
    chatId: { type: String, required: true },
    messageId: { type: Number, required: true }
  }],
  messages: [SupportMessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

SupportTicketSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (typeof next === 'function') next();
});

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
