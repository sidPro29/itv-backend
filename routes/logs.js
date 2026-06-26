const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   GET api/logs
// @desc    Get paginated list of activity logs
// @access  Private/Admin
router.get('/', [auth, admin], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    const total = await ActivityLog.countDocuments();
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username email role');

    res.json({
      total,
      limit,
      skip,
      logs
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
