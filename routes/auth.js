const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/signup
// @desc    Register user
// @access  Public
router.post('/signup', async (req, res) => {
  const { username, email, password, mobile } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      username,
      email,
      password,
      mobile
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Return JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, requirePasswordChange: user.mustChangePassword === true, user: { id: user.id, username: user.username, email: user.email, role: user.role, activePlans: user.activePlans } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (user.tempPasswordExpiresAt && new Date() > user.tempPasswordExpiresAt) {
      return res.status(403).json({ msg: 'Your temporary password has expired. Please request a new invitation.' });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, requirePasswordChange: user.mustChangePassword === true, user: { id: user.id, username: user.username, email: user.email, role: user.role, activePlans: user.activePlans } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;

// @route   POST api/auth/force-change-password
// @desc    Force user to change password on first login
// @access  Private
const authMiddleware = require('../middleware/auth');
router.post('/force-change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ msg: 'Please enter a password with 6 or more characters' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.mustChangePassword) {
      return res.status(400).json({ msg: 'Password change is not required' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear flags
    user.mustChangePassword = false;
    user.tempPasswordExpiresAt = undefined;

    await user.save();

    res.json({ msg: 'Password updated successfully. You can now access the dashboard.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
