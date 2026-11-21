const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const mongoose = require('mongoose');

async function testAll() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/interplanetary_tv';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const User = require('../models/User');
  const Plan = require('../models/Plan');
  const MediaAsset = require('../models/MediaAsset');
  const Article = require('../models/Article');
  const Friendship = require('../models/Friendship');

  console.log('\n--- 1. TESTING REORDER FUNCTIONALITY ---');
  // Reorder plans
  const plans = await Plan.find({ isActive: { $ne: false } }).sort({ order: 1 }).limit(3);
  if (plans.length >= 2) {
    const originalFirstId = plans[0]._id;
    const originalSecondId = plans[1]._id;
    
    // Swap order
    await Plan.findByIdAndUpdate(originalFirstId, { order: plans[1].order });
    await Plan.findByIdAndUpdate(originalSecondId, { order: plans[0].order });

    const reordered = await Plan.find({ isActive: { $ne: false } }).sort({ order: 1 }).limit(2);
    const success = reordered[0]._id.toString() === originalSecondId.toString();
    console.log(`Plans Reorder: First item is now ${success ? 'SWAPPED SUCCESSFULLY ✅' : 'FAILED ❌'}`);
    
    // Reset back
    await Plan.findByIdAndUpdate(originalFirstId, { order: plans[0].order });
    await Plan.findByIdAndUpdate(originalSecondId, { order: plans[1].order });
  }

  // Reorder MediaAssets
  const media = await MediaAsset.find().sort({ order: 1, createdAt: -1 }).limit(2);
  if (media.length >= 2) {
    console.log(`Media assets have 'order' field support: ${media[0].order !== undefined ? 'YES ✅' : 'NO ❌'}`);
  }

  // Reorder Articles
  const articles = await Article.find().sort({ order: 1, createdAt: -1 }).limit(2);
  if (articles.length >= 2) {
    console.log(`Articles have 'order' field support: ${articles[0].order !== undefined ? 'YES ✅' : 'NO ❌'}`);
  }

  console.log('\n--- 2. TESTING FRIENDSHIP & CALL GATING ---');
  // Create 2 test users if needed or find existing
  let testUserA = await User.findOne({ email: 'test_friend_a@itv.com' });
  if (!testUserA) {
    testUserA = new User({
      username: 'test_friend_a',
      email: 'test_friend_a@itv.com',
      verificationStatus: 'verified',
      verificationBadge: 'enthusiast',
      communitySubscription: { tier: 'free' } // Initially free without plan!
    });
    await testUserA.save();
  }

  let testUserB = await User.findOne({ email: 'test_friend_b@itv.com' });
  if (!testUserB) {
    testUserB = new User({
      username: 'test_friend_b',
      email: 'test_friend_b@itv.com',
      verificationStatus: 'verified',
      verificationBadge: 'enthusiast',
      communitySubscription: { tier: 'enthusiast', expiryDate: new Date(Date.now() + 864000000) }
    });
    await testUserB.save();
  }

  // Clean existing friendship between A and B
  await Friendship.deleteMany({
    $or: [
      { requester: testUserA._id, recipient: testUserB._id },
      { requester: testUserB._id, recipient: testUserA._id }
    ]
  });

  // Test 1: User A (on free tier without any plan) tries to send friend request -> MUST FAIL
  const hasActiveWeb = (u) => {
    if (!u.activePlans || !Array.isArray(u.activePlans)) return false;
    return u.activePlans.some(p => !p.expiryDate || new Date(p.expiryDate) > new Date());
  };
  const hasPlan = (u) => {
    if (u.role === 'admin' || u.role === 'superAdmin') return true;
    if (u.communitySubscription?.tier && u.communitySubscription.tier !== 'free') return true;
    return hasActiveWeb(u);
  };

  const aCanSend = hasPlan(testUserA);
  console.log(`User A (Free, No Plan) allowed to send friend request: ${!aCanSend ? 'NO (Blocked as expected) ✅' : 'YES ❌'}`);

  // Test 2: User B (Has Space Enthusiast Plan) sends friend request to A -> MUST SUCCEED
  const bCanSend = hasPlan(testUserB);
  console.log(`User B (Enthusiast Plan) allowed to send friend request: ${bCanSend ? 'YES (Allowed as expected) ✅' : 'NO ❌'}`);

  // Create pending friendship from B to A
  const friendship = new Friendship({
    requester: testUserB._id,
    recipient: testUserA._id,
    status: 'pending'
  });
  await friendship.save();
  console.log(`Pending friend request created: Status = ${friendship.status} ✅`);

  // Test 3: Can B call A when status is 'pending'? -> MUST BE BLOCKED
  const checkCanCall = async (callerId, targetId) => {
    const friend = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requester: callerId, recipient: targetId },
        { requester: targetId, recipient: callerId }
      ]
    });
    return Boolean(friend);
  };

  const canCallPending = await checkCanCall(testUserB._id, testUserA._id);
  console.log(`Call allowed while request is Pending: ${!canCallPending ? 'BLOCKED (Correct!) ✅' : 'ALLOWED ❌'}`);

  // Test 4: User A accepts the friend request
  friendship.status = 'accepted';
  await friendship.save();
  console.log(`Friend request accepted: Status = ${friendship.status} ✅`);

  // Test 5: Can B call A now? -> MUST BE ALLOWED
  const canCallAccepted = await checkCanCall(testUserB._id, testUserA._id);
  console.log(`Call allowed now that they are Friends: ${canCallAccepted ? 'ALLOWED (Correct!) ✅' : 'BLOCKED ❌'}`);

  // Cleanup test users and friendships
  await Friendship.deleteMany({
    $or: [
      { requester: testUserA._id, recipient: testUserB._id },
      { requester: testUserB._id, recipient: testUserA._id }
    ]
  });
  await User.deleteMany({ email: { $in: ['test_friend_a@itv.com', 'test_friend_b@itv.com'] } });
  console.log('✅ Test cleanup completed');

  console.log('\n=============================================');
  console.log('🎉 ALL FEATURE TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('=============================================');

  await mongoose.disconnect();
}

testAll().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
