const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const superAdmin = require('../middleware/superAdmin');
const { logActivity } = require('../utils/logger');

// Get current logged-in user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get current logged-in user's purchases
router.get('/my-purchases', auth, async (req, res) => {
  try {
    const purchases = await Purchase.find({ userId: req.user.id })
      .populate('planId')
      .sort({ purchaseDate: -1 });
    res.json(purchases);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all users (Admin only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update user (Self-update or Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { username, email, mobile, activePlans, role } = req.body;
    
    // Authorization check: User can only update their own profile, unless they are admin
    const isSelf = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superAdmin';
    
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ msg: 'Unauthorized to update this user' });
    }

    const userFields = {};
    if (username) userFields.username = username;
    if (email) userFields.email = email;
    if (mobile !== undefined) userFields.mobile = mobile;
    
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (username) user.username = username;
    if (email) user.email = email;
    if (mobile !== undefined) user.mobile = mobile;

    // Only admins can update role or activePlans
    if (isAdmin) {
      if (activePlans && Array.isArray(activePlans)) {
        user.activePlans = activePlans;
        user.markModified('activePlans');
      }
      if (role) {
        // Only superAdmins can promote someone to superAdmin
        if (role === 'superAdmin' && user.role !== 'superAdmin' && req.user.role !== 'superAdmin') {
          return res.status(403).json({ msg: 'Only SuperAdmin can promote users to superAdmin' });
        }
        user.role = role;
      }
    }

    await user.save();
    const updatedUser = await User.findById(user._id).select('-password');

    await logActivity(req, 'UPDATE', 'User', `Updated user profile: "${updatedUser.username || updatedUser.email}" (Role: ${updatedUser.role})`);
    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Delete user (SuperAdmin only)
router.delete('/:id', [auth, superAdmin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Prevent superAdmins from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'You cannot delete yourself' });
    }

    await User.findByIdAndDelete(req.params.id);
    await logActivity(req, 'DELETE', 'User', `Deleted user account: "${user.username || user.email}"`);
    res.json({ msg: 'User removed successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
