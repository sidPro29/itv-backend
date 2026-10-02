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
  
  // --- Community Platform Fields ---
  verificationStatus: { 
    type: String, 
    enum: ['unsubmitted', 'pending', 'verified', 'rejected'], 
    default: 'unsubmitted' 
  },
  verificationBadge: { 
    type: String, 
    enum: ['none', 'enthusiast', 'professional', 'entrepreneur'], 
    default: 'none' 
  },
  verificationDocs: {
    idDocumentUrl: String,
    docType: String,
    legalName: String,
    address: String,
    submittedAt: Date
  },
  verificationNotes: String,
  
  communityProfile: {
    fullName: String,
    bio: String,
    category: { type: String, enum: ['enthusiast', 'professional', 'entrepreneur'], default: 'enthusiast' },
    location: String,
    avatarUrl: String,
    coverUrl: String,
    linkedinUrl: String,
    additionalLinks: [{ label: String, url: String }],
    workExperience: [{
      company: String,
      role: String,
      startDate: String,
      endDate: String,
      current: Boolean,
      description: String
    }],
    education: [{
      institution: String,
      degree: String,
      fieldOfStudy: String,
      startYear: String,
      endYear: String
    }],
    skills: [String],
    certificates: [{
      title: String,
      issuer: String,
      issueDate: String,
      credentialUrl: String
    }],
    businessDetails: {
      companyName: String,
      designation: String,
      website: String,
      industry: String,
      description: String
    },
    interests: [String]
  },
  
  communitySubscription: {
    tier: { type: String, enum: ['free', 'basic', 'plus', 'pro'], default: 'free' },
    expiryDate: Date,
    unlockedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },

  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notifications: [{
    title: String,
    message: String,
    type: { type: String, enum: ['chat', 'call', 'verification', 'system'], default: 'system' },
    link: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  tempPasswordExpiresAt: { type: Date },
  mustChangePassword: { type: Boolean, default: false },
  twoFactorCode: { type: String },
  twoFactorCodeExpires: { type: Date },
  resetPasswordOTP: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
