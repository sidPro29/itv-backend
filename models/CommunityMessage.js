const mongoose = require('mongoose');

const CommunityMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  type: { type: String, enum: ['text', 'audio_call', 'video_call'], default: 'text' },
  callDurationSeconds: { type: Number, default: 0 },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommunityMessage', CommunityMessageSchema);
