const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const superAdmin = require('../middleware/superAdmin');
const { logActivity } = require('../utils/logger');

// Get all articles
router.get('/', async (req, res) => {
  try {
    const articles = await Article.find().sort({ createdAt: -1 });
    res.json(articles);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get single article by ID
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('comments.user', 'username email');
    if (!article) return res.status(404).json({ msg: 'Article not found' });
    res.json(article);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Article not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create article (Admin only)
router.post('/', [auth, superAdmin], async (req, res) => {
  try {
    const newArticle = new Article(req.body);
    const article = await newArticle.save();
    await logActivity(req, 'CREATE', 'Article', `Created article: "${article.title}"`);
    res.json(article);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete article (Admin only)
router.delete('/:id', [auth, superAdmin], async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ msg: 'Article not found' });
    await article.deleteOne();
    await logActivity(req, 'DELETE', 'Article', `Deleted article: "${article.title}"`);
    res.json({ msg: 'Article removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update article (Admin only)
router.put('/:id', [auth, superAdmin], async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ msg: 'Article not found' });
    const updated = await Article.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    await logActivity(req, 'UPDATE', 'Article', `Updated article: "${updated.title}"`);
    res.json(updated);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Increment view count (Public)
router.put('/:id/view', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ msg: 'Article not found' });
    article.views = (article.views || 0) + 1;
    await article.save();
    res.json({ views: article.views });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Toggle Like (Auth required)
router.put('/:id/like', auth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ msg: 'Article not found' });

    const index = article.likes.indexOf(req.user.id);
    if (index === -1) {
      article.likes.push(req.user.id);
    } else {
      article.likes.splice(index, 1);
    }
    await article.save();
    res.json(article.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add Comment (Auth required)
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ msg: 'Article not found' });

    const newComment = {
      user: req.user.id,
      text: req.body.text
    };

    article.comments.push(newComment);
    await article.save();

    // Populate user info before returning
    await article.populate('comments.user', 'username email');
    res.json(article.comments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
