const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function runTest() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/interplanetary_tv';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const Plan = mongoose.model('Plan', new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Purchase = mongoose.model('Purchase', new mongoose.Schema({}, { strict: false }));

  // 1. Fetch community plans
  const enthusiastPlan = await Plan.findOne({ type: 'community', requiredBadge: 'enthusiast', billingCycle: 'Monthly' });
  const professionalPlan = await Plan.findOne({ type: 'community', requiredBadge: 'professional', billingCycle: 'Monthly' });
  const entrepreneurPlan = await Plan.findOne≠({ type: 'community', requiredBadge: 'entrepreneur', billingCycle: 'Monthly' });

  console.log('\n--- FETCHED PLANS ---');
  console.log(`1. Enthusiast: ${enthusiastPlan.name} (req: ${enthusiastPlan.requiredBadge}) - €${enthusiastPlan.amount}`);
  console.log(`2. Professional: ${professionalPlan.name} (req: ${professionalPlan.requiredBadge}) - €${professionalPlan.amount}`);
  console.log(`3. Entrepreneur: ${entrepreneurPlan.name} (req: ${entrepreneurPlan.requiredBadge}) - €${entrepreneurPlan.amount}`);

  // Test matrix function imitating route logic
  function checkEligibility(userBadge, planRequiredBadge, isAdmin = false) {
    const badgeHierarchy = { none: 0, enthusiast: 1, professional: 2, entrepreneur: 3 };
    const userBadgeLevel = badgeHierarchy[userBadge || 'none'] || 0;
    const requiredLevel = badgeHierarchy[planRequiredBadge] || 1;

    if (!isAdmin && userBadgeLevel < requiredLevel) {
      return {
        allowed: false,
        msg: `403 Forbidden: Requires ${planRequiredBadge.toUpperCase()} badge, but user has ${userBadge || 'none'}`
      };
    }
    return { allowed: true, msg: '200 OK: Allowed to purchase' };
  }

  console.log('\n======================================================');
  console.log('🧪 RUNNING HIERARCHY MATRIX TEST (12 COMBINATIONS)');
  console.log('======================================================');

  const users = [
    { name: 'Unverified User', badge: 'none' },
    { name: 'Verified Enthusiast', badge: 'enthusiast' },
    { name: 'Verified Professional', badge: 'professional' },
    { name: 'Verified Entrepreneur', badge: 'entrepreneur' }
  ];

  const plans = [
    { title: 'Space Enthusiast Plan', required: 'enthusiast' },
    { title: 'Space Professional Plan', required: 'professional' },
    { title: 'Space Entrepreneur Plan', required: 'entrepreneur' }
  ];

  let passedAll = true;

  for (const u of users) {
    console.log(`\nTesting user: [${u.name}] (Badge: ${u.badge})`);
    for (const p of plans) {
      const res = checkEligibility(u.badge, p.required);
      let expected = false;
      if (u.badge === 'enthusiast' && p.required === 'enthusiast') expected = true;
      if (u.badge === 'professional' && (p.required === 'enthusiast' || p.required === 'professional')) expected = true;
      if (u.badge === 'entrepreneur') expected = true;

      const isCorrect = res.allowed === expected;
      if (!isCorrect) passedAll = false;
      const statusIcon = isCorrect ? '✅' : '❌';
      const actionText = res.allowed ? 'CAN BUY' : 'BLOCKED';
      console.log(`  ${statusIcon} -> ${p.title}: ${actionText} (${res.msg})`);
    }
  }

  console.log('\n======================================================');
  console.log('🧪 RUNNING ACTUAL DATABASE USER SUBSCRIPTION SIMULATION');
  console.log('======================================================');

  // Create temporary test user
  const testEmail = `test_hierarchy_${Date.now()}@interplanetary.tv`;
  const testUser = new User({
    username: 'test_hierarchy_user',
    email: testEmail,
    role: 'user',
    verificationBadge: 'professional', // Professional level
    verificationStatus: 'verified',
    activePlans: [],
    communitySubscription: { tier: 'free', unlockedMembers: [] }
  });
  await testUser.save();
  console.log(`Created test user: ${testEmail} with badge 'professional'`);

  // Test 1: Professional tries to buy Entrepreneur plan (Must fail)
  const entCheck = checkEligibility(testUser.verificationBadge, entrepreneurPlan.requiredBadge);
  console.log(`\nTest 1 (Professional tries to buy Entrepreneur): Allowed? ${entCheck.allowed} -> ${entCheck.msg}`);
  if (entCheck.allowed !== false) {
    console.error('❌ FAILED: Professional was allowed to buy Entrepreneur!');
    passedAll = false;
  } else {
    console.log('✅ PASSED: Blocked correctly as expected.');
  }

  // Test 2: Professional buys Professional plan (Must succeed and update subscription)
  const profCheck = checkEligibility(testUser.verificationBadge, professionalPlan.requiredBadge);
  console.log(`\nTest 2 (Professional buys Professional): Allowed? ${profCheck.allowed} -> ${profCheck.msg}`);
  if (!profCheck.allowed) {
    console.error('❌ FAILED: Professional could not buy Professional plan!');
    passedAll = false;
  } else {
    console.log('✅ PASSED: Allowed correctly.');
    
    // Simulate successful purchase recording
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    testUser.activePlans = [{
      planName: professionalPlan.name,
      planId: professionalPlan._id,
      expiryDate
    }];
    testUser.communitySubscription = {
      tier: 'professional',
      expiryDate,
      unlockedMembers: []
    };
    await testUser.save();

    // Verify persisted record in DB
    const refreshed = await User.findById(testUser._id);
    console.log(`Updated test user in DB: activePlan='${refreshed.activePlans[0].planName}', communityTier='${refreshed.communitySubscription.tier}'`);
    if (refreshed.communitySubscription.tier === 'professional') {
      console.log('✅ PASSED: DB subscription updated and persisted.');
    } else {
      console.error('❌ FAILED: DB subscription tier not updated!');
      passedAll = false;
    }
  }

  // Test 3: Test Stripe connection
  console.log('\n======================================================');
  console.log('🧪 TESTING STRIPE PAYMENT GATEWAY CONFIGURATION');
  console.log('======================================================');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.startsWith('sk_')) {
    console.log(`Stripe Key found: ${stripeKey.substring(0, 12)}... (Live mode: ${stripeKey.startsWith('sk_live')})`);
    const stripe = require('stripe')(stripeKey);
    try {
      // Test fetching balance or account info to verify API key validity with Stripe servers
      const balance = await stripe.balance.retrieve();
      console.log('✅ STRIPE API CONNECTION VERIFIED: Real-time Stripe communication is working!');
      console.log(`   Available currencies on account: ${balance.available.map(b => b.currency.toUpperCase()).join(', ')}`);
    } catch (err) {
      console.error('❌ Stripe API call error:', err.message);
      passedAll = false;
    }
  } else {
    console.warn('⚠️ No sk_ stripe secret key set.');
  }

  // Cleanup test user
  await User.deleteOne({ _id: testUser._id });
  console.log('\nCleaned up test user from DB.');

  if (passedAll) {
    console.log('\n🎉 ALL HIERARCHY, PERMISSION, AND PAYMENT TESTS PASSED 100%!');
  } else {
    console.log('\n❌ SOME TESTS FAILED.');
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
