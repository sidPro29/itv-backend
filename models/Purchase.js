const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  stripePaymentIntentId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  status: { type: String, enum: ['succeeded', 'pending', 'failed'], default: 'pending' },
  purchaseDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
