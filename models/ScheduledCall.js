const mongoose = require('mongoose');

const ScheduledCallSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  callType: { type: String, enum: ['video', 'audio'], default: 'video' },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, default: 30 },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  roomId: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'active', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScheduledCall', ScheduledCallSchema);
