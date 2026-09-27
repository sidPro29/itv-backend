const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { logActivity } = require('../utils/logger');

// @route   GET /api/admin/community/verifications
// @desc    List all verification requests for CMS
// @access  Admin
router.get('/verifications', [auth, admin], async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) {
      query.verificationStatus = status;
    } else {
      query.verificationStatus = { $in: ['pending', 'verified', 'rejected'] };
    }

    const requests = await User.find(query)
      .select('-password -stripeCustomerId -twoFactorCode -resetPasswordOTP')
      .sort({ 'verificationDocs.submittedAt': -1, createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Error fetching admin verifications:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/admin/community/verifications/:userId
// @desc    Approve / Reject user verification and assign Category Badge
// @access  Admin
router.put('/verifications/:userId', [auth, admin], async (req, res) => {
  try {
    const { verificationStatus, verificationBadge, notes } = req.body;
    
    if (!['verified', 'rejected', 'pending'].includes(verificationStatus)) {
      return res.status(400).json({ msg: 'Invalid verification status' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.verificationStatus = verificationStatus;
    if (verificationBadge && ['enthusiast', 'professional', 'entrepreneur'].includes(verificationBadge)) {
      user.verificationBadge = verificationBadge;
      if (user.communityProfile) {
        user.communityProfile.category = verificationBadge;
      }
    }
    if (notes !== undefined) {
      user.verificationNotes = notes;
    }

    await user.save();

    await logActivity(req, 'UPDATE', 'CommunityVerification', `Admin updated verification for "${user.username || user.email}" to status "${verificationStatus}" with badge "${user.verificationBadge}"`);

    res.json({
      msg: `User verification updated to ${verificationStatus}`,
      user: {
        _id: user._id,
        verificationStatus: user.verificationStatus,
        verificationBadge: user.verificationBadge,
        verificationNotes: user.verificationNotes
      }
    });
  } catch (err) {
    console.error('Error updating admin verification:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
