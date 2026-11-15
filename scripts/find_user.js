const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const mongoose = require('mongoose');

async function findUsers() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/interplanetary_tv');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find();
  for (const u of users) {
    const fn = (u.communityProfile && u.communityProfile.fullName) || '';
    const un = u.username || '';
    const em = u.email || '';
    if (fn.toLowerCase().includes('siddhartha') || un.toLowerCase().includes('sid') || em.toLowerCase().includes('sid')) {
      console.log('USER_FOUND:', JSON.stringify({
        id: u._id,
        username: u.username,
        email: u.email,
        role: u.role,
        verificationBadge: u.verificationBadge,
        verificationStatus: u.verificationStatus,
        profileCategory: u.communityProfile ? u.communityProfile.category : null,
        communitySubscription: u.communitySubscription
      }, null, 2));
    }
  }
  await mongoose.disconnect();
}

findUsers().catch(console.error);
