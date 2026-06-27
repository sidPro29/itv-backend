const express = require('express');
const router = express.Router();
const Apk = require('../models/Apk');
const auth = require('../middleware/auth');

// @route   GET /api/apks
// @desc    Get all APKs
// @access  Public
router.get('/', async (req, res) => {
  try {
    const apks = await Apk.find().sort({ createdAt: -1 });
    res.json({ success: true, data: apks });
  } catch (error) {
    console.error('Error fetching APKs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching APKs' });
  }
});

// @route   POST /api/apks
// @desc    Add a new APK
// @access  Private (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Only allow admin or superAdmin
    if (req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { title, imageUrl, apkUrl } = req.body;
    
    if (!title || !imageUrl || !apkUrl) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields (title, imageUrl, apkUrl)' });
    }

    const apk = new Apk({
      title,
      imageUrl,
      apkUrl
    });

    await apk.save();
    res.status(201).json({ success: true, data: apk });
  } catch (error) {
    console.error('Error adding APK:', error);
    res.status(500).json({ success: false, message: 'Server error adding APK' });
  }
});

// @route   DELETE /api/apks/:id
// @desc    Delete an APK
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const apk = await Apk.findById(req.params.id);
    if (!apk) {
      return res.status(404).json({ success: false, message: 'APK not found' });
    }

    await apk.deleteOne();
    res.json({ success: true, message: 'APK deleted' });
  } catch (error) {
    console.error('Error deleting APK:', error);
    res.status(500).json({ success: false, message: 'Server error deleting APK' });
  }
});

module.exports = router;
