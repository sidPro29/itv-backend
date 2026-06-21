const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER || 'ethereal_user',
      pass: process.env.SMTP_PASS || 'ethereal_pass'
    }
  });
};

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

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to user
    user.twoFactorCode = otpCode;
    user.twoFactorCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP via email
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = createTransporter();
        const mailOptions = {
          from: `"Interplanetary" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Your 2FA Login Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #333; text-align: center;">Login Verification</h2>
              <p style="color: #555; text-align: center;">Use the code below to complete your login. It expires in 10 minutes.</p>
              <div style="background: #f8f9fa; border-left: 4px solid #0056b3; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111;">${otpCode}</span>
              </div>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log(`2FA Code sent to ${email}`);
      } else {
        console.log(`[Email Simulation] 2FA Code for ${email}: ${otpCode}`);
      }
    } catch (emailErr) {
      console.error('Error sending 2FA email:', emailErr);
      return res.status(500).json({ msg: 'Error sending verification email. Please try again later.' });
    }

    // Return requires2FA flag
    res.json({ requires2FA: true, email: user.email, msg: 'Verification code sent to your email.' });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/verify-2fa
// @desc    Verify 2FA code and get token
// @access  Public
router.post('/verify-2fa', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ msg: 'Email and code are required' });
  }

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid request' });
    }

    if (!user.twoFactorCode || user.twoFactorCode !== code) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }

    if (user.twoFactorCodeExpires && new Date() > user.twoFactorCodeExpires) {
      return res.status(400).json({ msg: 'Verification code has expired' });
    }

    // Code is valid. Clear it.
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpires = undefined;
    await user.save();

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '10h' },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token, 
          requirePasswordChange: user.mustChangePassword === true, 
          user: { id: user.id, username: user.username, email: user.email, role: user.role, activePlans: user.activePlans } 
        });
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
