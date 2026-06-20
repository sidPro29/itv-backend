const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, trim: true, sparse: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  firebaseUid: { type: String, unique: true, sparse: true },
  stripeCustomerId: { type: String, unique: true, sparse: true },
  mobile: { type: String },
  password: { type: String },
  role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
  activePlans: [{
    planName: String,
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    expiryDate: Date
  }],
  lastDevice: { type: String, enum: ['android', 'ios', 'web', 'tv'], default: 'web' },
  tempPasswordExpiresAt: { type: Date },
  mustChangePassword: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
