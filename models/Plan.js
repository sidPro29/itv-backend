const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  wpPlanId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['regular', 'adsPlan', 'community'], default: 'regular' },
  category: { type: String, enum: ['viewer', 'creator', 'smallBusiness', 'corporate', 'community'], default: 'viewer' },
  tagline: { type: String },
  ctaText: { type: String },
  badge: { type: String },
  requiredBadge: { type: String, enum: ['none', 'enthusiast', 'professional', 'entrepreneur'], default: 'none' },
  benefits: [{ type: String }],
  description: { type: String },
  currency: { type: String, default: 'EUR' },
  billingCycle: { type: String, default: 'Monthly' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', PlanSchema);
