const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const isSmtpConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER || 'ethereal_user',
      pass: process.env.SMTP_PASS || 'ethereal_pass'
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'false' ? false : true
    }
  });
};

// @route   GET api/auth/smtp-status
// @desc    Check if SMTP email service is configured and verify connection
// @access  Public
router.get('/smtp-status', async (req, res) => {
  const configured = isSmtpConfigured();
  if (!configured) {
    return res.json({
      configured: false,
      msg: 'SMTP email credentials not set. Running in simulation mode (logins bypass 2FA until SMTP is configured).'
    });
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    res.json({
      configured: true,
      connected: true,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      user: process.env.SMTP_USER,
      msg: 'SMTP connection verified successfully.'
    });
  } catch (err) {
    res.status(500).json({
      configured: true,
      connected: false,
      error: err.message,
      msg: 'SMTP configured but connection failed. Please check host, port, user or app password.'
    });
  }
});

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
        role: user.role,
        email: user.email,
        username: user.username
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
  const { email, password, isCms, skip2FA } = req.body;
  try {
    let user = await User.findOne({
      $or: [
        { email: email ? email.toLowerCase() : '' },
        { username: email }
      ]
    });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }
    if (isCms && user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Access denied. You do not have permission to access the CMS.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (user.tempPasswordExpiresAt && new Date() > user.tempPasswordExpiresAt) {
      return res.status(403).json({ msg: 'Your temporary password has expired. Please request a new invitation.' });
    }

    const smtpReady = isSmtpConfigured();
    const disable2FA = process.env.DISABLE_2FA === 'true';

    // If 2FA is skipped, explicitly disabled, or SMTP is not configured (to prevent locking users out)
    if (skip2FA || disable2FA || (!smtpReady && process.env.REQUIRE_2FA_WITHOUT_SMTP !== 'true')) {
      const payload = {
        user: {
          id: user.id,
          role: user.role,
          email: user.email,
          username: user.username
        }
      };
      return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '7d' },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token, 
            requirePasswordChange: user.mustChangePassword === true, 
            user: { id: user.id, username: user.username, email: user.email, role: user.role, activePlans: user.activePlans } 
          });
        }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to user
    user.twoFactorCode = otpCode;
    user.twoFactorCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP via email
    try {
      if (smtpReady) {
        const transporter = createTransporter();
        const fromAddress = process.env.SMTP_FROM || `"Interplanetary TV" <${process.env.SMTP_USER}>`;
        const mailOptions = {
          from: fromAddress,
          to: email,
          subject: 'Your 2FA Login Code - Interplanetary TV',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #1a1a2e; border-radius: 12px; background: #0b0c15; color: #ffffff;">
              <h2 style="color: #6366f1; text-align: center; margin-top: 0;">Interplanetary TV</h2>
              <h3 style="color: #e2e8f0; text-align: center;">Login Verification</h3>
              <p style="color: #94a3b8; text-align: center; font-size: 14px;">Use the verification code below to complete your login. It expires in 10 minutes.</p>
              <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid #6366f1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc;">${otpCode}</span>
              </div>
              <p style="color: #64748b; font-size: 12px; text-align: center; margin-bottom: 0;">If you did not request this login code, please secure your account immediately.</p>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log(`2FA Code successfully sent to ${email}`);
      } else {
        console.log(`[Email Simulation] 2FA Code for ${email}: ${otpCode}`);
      }
    } catch (emailErr) {
      console.error('Error sending 2FA email:', emailErr);
      return res.status(500).json({ msg: 'Error sending verification email. Please try again later.' });
    }

    // Return requires2FA flag
    res.json({ 
      requires2FA: true, 
      email: user.email, 
      msg: 'Verification code sent to your email.' + (!smtpReady ? ' (Simulation Mode)' : ''),
      ...(smtpReady ? {} : { simulationOtp: otpCode })
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


// @route   POST api/auth/verify-2fa
// @desc    Verify 2FA code and get token
// @access  Public
router.post('/verify-2fa', async (req, res) => {
  const { email, code, isCms } = req.body;

  if (!email || !code) {
    return res.status(400).json({ msg: 'Email and code are required' });
  }

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid request' });
    }

    if (isCms && user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({ msg: 'Access denied. You do not have permission to access the CMS.' });
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

    if (isCms) {
      const ActivityLog = require('../models/ActivityLog');
      const log = new ActivityLog({
        user: user._id,
        username: user.username || user.email,
        action: 'LOGIN',
        collectionName: 'User',
        details: 'Logged into CMS dashboard'
      });
      await log.save().catch(e => console.error('Error logging CMS login:', e));
    }

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        username: user.username
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
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

// @route   POST api/auth/forgot-password
// @desc    Send OTP to user email for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email address' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.resetPasswordOTP = otpCode;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP via email
    try {
      const smtpReady = isSmtpConfigured();
      if (smtpReady) {
        const transporter = createTransporter();
        const fromAddress = process.env.SMTP_FROM || `"Interplanetary TV" <${process.env.SMTP_USER}>`;
        const mailOptions = {
          from: fromAddress,
          to: user.email,
          subject: 'Password Reset Verification Code - Interplanetary TV',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #1a1a2e; border-radius: 12px; background: #0b0c15; color: #ffffff;">
              <h2 style="color: #6366f1; text-align: center; margin-top: 0;">Interplanetary TV</h2>
              <h3 style="color: #e2e8f0; text-align: center;">Reset Your Password</h3>
              <p style="color: #94a3b8; text-align: center; font-size: 14px;">You requested to reset your password. Use the verification code below. It expires in 10 minutes.</p>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #fca5a5;">${otpCode}</span>
              </div>
              <p style="color: #64748b; font-size: 12px; text-align: center; margin-bottom: 0;">If you did not request this password reset, please ignore this email.</p>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Password reset OTP sent to ${user.email}`);
        return res.json({ msg: 'Password reset verification code has been sent to your email.' });
      } else {
        console.log(`[Email Simulation] Password Reset OTP for ${user.email}: ${otpCode}`);
        return res.json({ 
          msg: 'Password reset verification code generated (Simulation Mode).',
          simulationOtp: otpCode 
        });
      }
    } catch (emailErr) {
      console.error('Error sending reset password email:', emailErr);
      return res.status(500).json({ msg: 'Error sending verification email. Please try again later.' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/reset-password
// @desc    Verify OTP and set new password
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};

  if (!email || !code || !newPassword) {
    return res.status(400).json({ msg: 'Email, verification code, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters long' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid request' });
    }

    if (!user.resetPasswordOTP || user.resetPasswordOTP !== code) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }

    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ msg: 'Verification code has expired. Please request a new code.' });
    }

    // OTP is valid. Update password.
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

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

module.exports = router;
