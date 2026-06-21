const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');
const superAdmin = require('../middleware/superAdmin');

// Set up Nodemailer transporter
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

// @route   GET api/admin/cms-users
// @desc    Get all CMS users (admin, superAdmin)
// @access  Private/SuperAdmin
router.get('/', [auth, superAdmin], async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/cms-users/invite
// @desc    Invite a new CMS user (admin)
// @access  Private/SuperAdmin
router.post('/invite', [auth, superAdmin], async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: 'Please include an email address' });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Generate random 10-character password
    const plainPassword = crypto.randomBytes(5).toString('hex');
    
    user = new User({
      email,
      role: 'admin',
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(plainPassword, salt);

    await user.save();

    // Send Email
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = createTransporter();
        const mailOptions = {
          from: `"Interplanetary" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Invitation to join Interplanetary CMS',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #fafafa;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #1a1a1a; margin: 0; letter-spacing: 1px;">INTERPLANETARY</h1>
              </div>
              <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #eeeeee;">
                <h2 style="color: #333333; margin-top: 0; text-align: center;">Welcome to the CMS!</h2>
                <p style="color: #555555; font-size: 16px; line-height: 1.6;">You have been invited to join the Interplanetary Content Management System as an Admin.</p>
                
                <div style="background-color: #f8f9fa; border-left: 4px solid #0056b3; padding: 15px; margin: 25px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #666666; text-transform: uppercase; font-weight: bold;">Your Temporary Password</p>
                  <p style="margin: 10px 0 0 0; font-size: 28px; font-weight: bold; color: #111111; letter-spacing: 3px; text-align: center;">${plainPassword}</p>
                </div>
                
                <p style="color: #666666; font-size: 14px; text-align: center; margin-top: 20px; padding: 0 15px;">
                  <em>For security purposes, this temporary password will expire in <strong>24 hours</strong>. You will be prompted to create a new secure password upon your first login.</em>
                </p>
                
                <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
                  <a href="http://localhost:5174/" style="background-color: #0056b3; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Login to CMS</a>
                </div>
                <p style="text-align: center; font-size: 12px; color: #999;">(In production, this button will link to your live CMS domain)</p>
              </div>
              
              <div style="text-align: center; margin-top: 25px; color: #888888; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Interplanetary. All rights reserved.<br/>
                This is an automated message, please do not reply.
              </div>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Invitation sent to ${email}`);
      } else {
        console.log(`[Email Simulation] Invitation to ${email}. Temporary password: ${plainPassword}`);
      }
    } catch (emailErr) {
      console.error('Error sending email:', emailErr);
      // Still return success since user was created
      return res.status(201).json({ msg: 'User created but email failed to send. Check server logs.', password: plainPassword });
    }

    res.status(201).json({ msg: 'Invitation sent successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/admin/cms-users/:id
// @desc    Delete a CMS user
// @access  Private/SuperAdmin
router.delete('/:id', [auth, superAdmin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!['admin', 'superAdmin'].includes(user.role)) {
      return res.status(400).json({ msg: 'Cannot delete regular users from this endpoint' });
    }

    // Prevent deleting oneself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'You cannot delete yourself' });
    }

    await User.findByIdAndDelete(req.params.id);
    
    res.json({ msg: 'CMS user removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
