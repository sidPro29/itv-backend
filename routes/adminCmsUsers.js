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
          from: `"iTV Admin" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Invitation to join iTV CMS',
          text: `You have been invited to join the iTV CMS as an Admin.\n\nYour temporary password is: ${plainPassword}\n\nThis password is valid for 24 hours. You must log in and change your password within this time.`
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
