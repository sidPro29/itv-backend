const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all pages
router.get('/', async (req, res) => {
  try {
    const pages = await Page.find();
    res.json(pages);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get page by key
router.get('/:key', async (req, res) => {
  try {
    const page = await Page.findOne({ key: req.params.key });
    if (!page) {
      return res.status(404).json({ msg: 'Page not found' });
    }
    res.json(page);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update page content by key
router.put('/:key', [auth, admin], async (req, res) => {
  try {
    const { title, content } = req.body;
    let page = await Page.findOne({ key: req.params.key });

    if (!page) {
      return res.status(404).json({ msg: 'Page not found' });
    }

    if (title !== undefined) page.title = title;
    if (content !== undefined) page.content = content;
    page.updatedAt = Date.now();

    await page.save();
    const { logActivity } = require('../utils/logger');
    await logActivity(req, 'UPDATE', 'Page', `Updated page settings for: "${page.title}" (${page.key})`);
    res.json(page);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
