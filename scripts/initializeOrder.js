const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const mongoose = require('mongoose');

async function initOrder() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/interplanetary_tv';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const Plan = require('../models/Plan');
  const MediaAsset = require('../models/MediaAsset');
  const Article = require('../models/Article');
  const User = require('../models/User');

  // Initialize Plan orders
  const plans = await Plan.find().sort({ amount: 1 });
  for (let i = 0; i < plans.length; i++) {
    await Plan.findByIdAndUpdate(plans[i]._id, { order: i });
  }
  console.log(`✅ Initialized order for ${plans.length} plans`);

  // Initialize MediaAsset orders
  const media = await MediaAsset.find().sort({ createdAt: -1 });
  for (let i = 0; i < media.length; i++) {
    await MediaAsset.findByIdAndUpdate(media[i]._id, { order: i });
  }
  console.log(`✅ Initialized order for ${media.length} media assets`);

  // Initialize Article orders
  const articles = await Article.find().sort({ createdAt: -1 });
  for (let i = 0; i < articles.length; i++) {
    await Article.findByIdAndUpdate(articles[i]._id, { order: i });
  }
  console.log(`✅ Initialized order for ${articles.length} articles`);

  // Initialize User orders
  const users = await User.find().sort({ createdAt: -1 });
  for (let i = 0; i < users.length; i++) {
    await User.findByIdAndUpdate(users[i]._id, { order: i });
  }
  console.log(`✅ Initialized order for ${users.length} users`);

  await mongoose.disconnect();
}

initOrder().catch(err => {
  console.error(err);
  process.exit(1);
});
