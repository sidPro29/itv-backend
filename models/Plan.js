const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  wpPlanId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['regular', 'adsPlan'], default: 'regular' },
  benefits: [{ type: String }],
  description: { type: String },
  currency: { type: String, default: 'EUR' },
  billingCycle: { type: String, default: 'Monthly' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', PlanSchema);
