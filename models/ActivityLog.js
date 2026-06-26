const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String, required: true },
  action: { type: String, required: true }, // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
  collectionName: { type: String, required: true }, // 'MediaAsset', 'Article', 'User', 'Plan', 'Page'
  details: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
