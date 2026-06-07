const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all plans
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create plan (Admin only)
router.post('/', [auth, admin], async (req, res) => {
  try {
    const newPlan = new Plan(req.body);
    const plan = await newPlan.save();
    res.json(plan);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update plan (Admin only)
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ msg: 'Plan not found' });
    const updated = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(updated);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete plan (Admin only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ msg: 'Plan not found' });
    await plan.deleteOne();
    res.json({ msg: 'Plan removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Purchase a plan
router.post('/purchase', auth, async (req, res) => {
  const { planId, stripeTokenId } = req.body;

  try {
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ msg: 'Plan not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const now = new Date();
    // Check if user has an active plan
    const activePlan = user.activePlans.find(ap => ap.expiryDate > now);

    if (activePlan) {
      // 1. Can't purchase an already active plan
      if (activePlan.planId && activePlan.planId.toString() === plan._id.toString()) {
        return res.status(400).json({ msg: 'This plan is already active on your account.' });
      }

      // 2. Can't purchase a plan with lower amount/month than currently active plan
      const activePlanDetails = await Plan.findById(activePlan.planId);
      if (activePlanDetails) {
        const activeMonthlyRate = activePlanDetails.billingCycle === 'Yearly' 
          ? activePlanDetails.amount / 12 
          : activePlanDetails.amount;
        const targetMonthlyRate = plan.billingCycle === 'Yearly' 
          ? plan.amount / 12 
          : plan.amount;

        if (targetMonthlyRate < activeMonthlyRate) {
          return res.status(400).json({ 
            msg: `You cannot downgrade to a plan with a lower price than your current active plan (${activePlanDetails.name}).` 
          });
        }
      }
    }

    // Stripe processing (mock if STRIPE_SECRET_KEY is not defined)
    let paymentId = 'pi_mock_' + Math.random().toString(36).substring(2, 11) + Date.now();
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      try {
        const charge = await stripe.charges.create({
          amount: Math.round(plan.amount * 100),
          currency: (plan.currency || 'EUR').toLowerCase(),
          source: stripeTokenId,
          description: `Subscription to ${plan.name} for User ${user.email}`
        });
        paymentId = charge.id;
      } catch (err) {
        console.error("Stripe Charge Error:", err);
        return res.status(400).json({ msg: `Payment failed: ${err.message}` });
      }
    }

    // Create Purchase document
    const purchase = new Purchase({
      userId: user._id,
      planId: plan._id,
      stripePaymentIntentId: paymentId,
      amount: plan.amount,
      currency: plan.currency || 'EUR',
      status: 'succeeded',
      purchaseDate: new Date()
    });
    await purchase.save();

    // Update User profile
    const expiryDate = new Date();
    if (plan.billingCycle === 'Yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    user.activePlans = [{
      planName: plan.name,
      planId: plan._id,
      expiryDate
    }];
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
