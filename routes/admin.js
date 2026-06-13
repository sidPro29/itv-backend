const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MediaAsset = require('../models/MediaAsset');
const Article = require('../models/Article');
const Purchase = require('../models/Purchase');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get Dashboard and Analytics Stats
router.get('/stats', [auth, admin], async (req, res) => {
  try {
    const users = await User.find({}, 'createdAt');
    const totalSubscribers = users.length;
    const totalPurchasesCount = await Purchase.countDocuments();
    
    // Total Revenue (sum of amounts in Purchase collection)
    const purchases = await Purchase.find({});
    const totalRevenue = purchases.reduce((acc, p) => acc + (p.amount || 0), 0);

    // Media Assets breakdown
    const mediaAssets = await MediaAsset.find({});
    const totalVideos = mediaAssets.filter(a => a.type === 'video').length;
    const totalMovies = mediaAssets.filter(a => a.type === 'movie' || a.type === 'movies').length;
    const totalShows = mediaAssets.filter(a => a.type === 'tvshow' || a.type === 'tvshows').length;
    const totalEpisodes = mediaAssets.filter(a => a.type === 'episode').length;
    
    let totalMediaViews = 0;
    let totalMediaLikes = 0;
    mediaAssets.forEach(a => {
      totalMediaViews += (a.views || 0);
      totalMediaLikes += (a.likes ? a.likes.length : 0);
    });

    // Articles breakdown
    const articles = await Article.find({});
    let totalArticleViews = 0;
    let totalArticleLikes = 0;
    let totalComments = 0;

    articles.forEach(a => {
      totalArticleViews += (a.views || 0);
      totalArticleLikes += (a.likes ? a.likes.length : 0);
      totalComments += (a.comments ? a.comments.length : 0);
    });

    const totalViews = totalMediaViews + totalArticleViews;
    const totalLikes = totalMediaLikes + totalArticleLikes;

    // Time-series data for actual User Growth (Last 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const growthBuckets = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      growthBuckets.push({
        name: monthNames[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        count: 0
      });
    }

    growthBuckets.forEach(bucket => {
      const endOfMonth = new Date(bucket.year, bucket.month + 1, 0, 23, 59, 59);
      bucket.count = users.filter(u => new Date(u.createdAt) <= endOfMonth).length;
    });

    const subscriberGrowth = growthBuckets.map(b => ({ name: b.name, count: b.count }));

    res.json({
      totalSubscribers,
      totalRevenue,
      totalPurchases: totalPurchasesCount,
      totalViews,
      totalMediaViews,
      totalArticleViews,
      totalLikes,
      totalComments,
      contentDistribution: {
        totalVideos,
        totalMovies,
        totalShows,
        totalEpisodes
      },
      subscriberGrowth
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all purchases for table
router.get('/purchases', [auth, admin], async (req, res) => {
  try {
    const purchases = await Purchase.find({})
      .populate('userId', 'username email')
      .populate('planId', 'name amount billingCycle')
      .sort({ purchaseDate: -1 });
    res.json(purchases);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
