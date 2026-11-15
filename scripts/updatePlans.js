require('dotenv').config();
const crypto = require('crypto');
if (!global.crypto) {
  global.crypto = crypto;
}
const mongoose = require('mongoose');
const Plan = require('../models/Plan');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://itv_mongo:27017/itv';

const plansData = [
  // ==========================================
  // PART 1: VIEWER / STREAMING PLANS (B2C)
  // ==========================================
  {
    lookupNames: ['explorer', 'basic sd'],
    name: 'Explorer (Basic SD)',
    amount: 1.99,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Essential space entertainment on a budget.',
    description: 'Essential space entertainment on a budget.',
    ctaText: 'Start Exploring',
    badge: null,
    benefits: [
      'Standard Definition (SD) streaming across supported devices.',
      'Full access to our core library of space documentaries, sci-fi series, and indie films.',
      'Ad-supported streaming experience.'
    ]
  },
  {
    lookupNames: ['navigator', 'standard hd'],
    name: 'Navigator (Standard HD)',
    amount: 5.99,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Crisp high-definition streaming for true space enthusiasts.',
    description: 'Crisp high-definition streaming for true space enthusiasts.',
    ctaText: 'Choose Navigator',
    badge: 'Most Popular',
    benefits: [
      'Crystal-clear High Definition (HD) playback.',
      'Expanded access to featured films, news segments, and special releases.',
      'Uninterrupted, streamlined viewing experience.'
    ]
  },
  {
    lookupNames: ['commander', 'premium hd'],
    name: 'Commander (Premium HD)',
    amount: 8.99,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'The ultimate HD viewing experience with priority access.',
    description: 'The ultimate HD viewing experience with priority access.',
    ctaText: 'Go Commander',
    badge: 'Recommended',
    benefits: [
      'Premium High Definition streaming with enhanced audio depth.',
      'Priority access to live space mission broadcasts and exclusive premieres.',
      'Multi-device streaming support.'
    ]
  },
  {
    lookupNames: ['cosmonaut', 'premium+ 4k monthly', 'premium+ 4k'],
    name: 'Cosmonaut (Premium+ 4K Ultra HD)',
    amount: 9.99,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Breathtaking cinematic immersion in stunning 4K resolution.',
    description: 'Breathtaking cinematic immersion in stunning 4K resolution.',
    ctaText: 'Unlock 4K Ultra',
    badge: null,
    benefits: [
      'Ultra-HD 4K streaming for awe-inspiring cosmic visuals.',
      'Zero ads, zero interruptions—pure stellar entertainment.',
      'Early access to original documentaries, director cuts, and high-end science features.'
    ]
  },
  {
    lookupNames: ['cosmonaut yearly', 'premium+ 4k yearly'],
    name: 'Cosmonaut (Premium+ 4K Ultra HD) - Yearly',
    amount: 99,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Breathtaking cinematic immersion in stunning 4K resolution (Annual plan).',
    description: 'Breathtaking cinematic immersion in stunning 4K resolution.',
    ctaText: 'Unlock 4K Ultra Annual',
    badge: 'Best Value',
    benefits: [
      'Ultra-HD 4K streaming for awe-inspiring cosmic visuals.',
      'Zero ads, zero interruptions—pure stellar entertainment.',
      'Early access to original documentaries, director cuts, and high-end science features.',
      'Save with annual billing (2 months free).'
    ]
  },

  // ==========================================
  // PART 2: CREATOR & BLOGGER ADVERTISING (B2B)
  // ==========================================
  {
    lookupNames: ['creator launchpad', 'blogger 1 ad plan'],
    name: 'Creator Launchpad (1 Ad Slot)',
    amount: 199,
    type: 'adsPlan',
    category: 'creator',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Kickstart your brand presence within a targeted space community.',
    description: 'Kickstart your brand presence within a targeted space community.',
    ctaText: 'Launch Campaign',
    badge: null,
    benefits: [
      '1 dedicated promotional ad placement across iTV streaming segments.',
      'Ideal for independent creators, authors, and niche educators.',
      'Standard audience analytics and reporting.'
    ]
  },
  {
    lookupNames: ['creator orbit', 'blogger 2 ad plan'],
    name: 'Creator Orbit (2 Ad Slots)',
    amount: 299,
    type: 'adsPlan',
    category: 'creator',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Double your impact and reach engaged science-fiction & science fans.',
    description: 'Double your impact and reach engaged science-fiction & science fans.',
    ctaText: 'Expand Reach',
    badge: 'Popular for Creators',
    benefits: [
      '2 concurrent promotional ad placements across high-traffic inventory.',
      'Enhanced visibility rotation during peak viewing hours.',
      'Monthly performance insights to optimize conversion.'
    ]
  },

  // ==========================================
  // PART 3: SMALL BUSINESS ADVERTISING (B2B)
  // ==========================================
  {
    lookupNames: ['enterprise spark', 'small business 1 ad plan'],
    name: 'Enterprise Spark (Single Ad Tier)',
    amount: 999,
    type: 'adsPlan',
    category: 'smallBusiness',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Direct brand integration for growing businesses in tech and science.',
    description: 'Direct brand integration for growing businesses in tech and science.',
    ctaText: 'Partner with Us',
    badge: null,
    benefits: [
      'Premium placement for 1 core promotional asset.',
      'Reaches dedicated tech-forward and space-enthusiast audiences globally.',
      'Dedicated campaign support and impression tracking.'
    ]
  },
  {
    lookupNames: ['enterprise nebula', 'small business 2 ad plan'],
    name: 'Enterprise Nebula (Dual Ad Tier)',
    amount: 1999,
    type: 'adsPlan',
    category: 'smallBusiness',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Wider coverage and robust visibility across multiple iTV channels.',
    description: 'Wider coverage and robust visibility across multiple iTV channels.',
    ctaText: 'Accelerate Growth',
    badge: 'High Impact',
    benefits: [
      '2 high-impact ad placements tailored for scaling businesses.',
      'Priority scheduling across selected documentary and news categories.',
      'Comprehensive analytics dashboard access.'
    ]
  },

  // ==========================================
  // PART 4: CORPORATE BUSINESS ADVERTISING (B2B)
  // ==========================================
  {
    lookupNames: ['galactic horizon', 'business 1 ad plan'],
    name: 'Galactic Horizon (Primary Corporate)',
    amount: 2999,
    type: 'adsPlan',
    category: 'corporate',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Substantial brand exposure for industry leaders and major innovators.',
    description: 'Substantial brand exposure for industry leaders and major innovators.',
    ctaText: 'Secure Horizon',
    badge: null,
    benefits: [
      'High-frequency primary ad placement across premium network programming.',
      'Custom demographic targeting within space exploration and tech sectors.',
      'Dedicated account management and campaign optimization.'
    ]
  },
  {
    lookupNames: ['cosmic syndicate', 'business 2 ad plan'],
    name: 'Cosmic Syndicate (Elite Corporate Sponsorship)',
    amount: 4999,
    type: 'adsPlan',
    category: 'corporate',
    billingCycle: 'Monthly',
    currency: 'EUR',
    tagline: 'Ultimate network-wide dominance and premium title sponsorship integration.',
    description: 'Ultimate network-wide dominance and premium title sponsorship integration.',
    ctaText: 'Claim Elite Status',
    badge: 'Enterprise Elite',
    benefits: [
      'Maximum share of voice with dual premium corporate ad slots.',
      'Exclusive brand feature opportunities alongside major live broadcasts and docu-series.',
      'Full-suite enterprise analytics, custom reporting, and priority placement.'
    ]
  },

  // ==========================================
  // PART 5: COMMUNITY PLATFORM PLANS
  // ==========================================
  {
    lookupNames: ['space enthusiast - monthly', 'space enthusiast monthly'],
    name: 'Space Enthusiast - Monthly (€1.99 + VAT)',
    amount: 1.99,
    type: 'community',
    category: 'community',
    billingCycle: 'Monthly',
    currency: 'EUR',
    requiredBadge: 'enthusiast',
    tagline: 'Step inside the global space community and connect with fellow pioneers.',
    description: 'Step inside the global space community and connect with fellow pioneers.',
    ctaText: 'Join as Enthusiast',
    badge: null,
    benefits: [
      'Start Free: Create and verify your profile, upload a photo, banner, and resume, browse the community directory, and connect via text chat and friend requests.',
      'Upgrade for €1.99/mo + VAT: Unlock unlimited text messaging plus unlimited voice and video calls across the network.',
      'Personal contact details remain hidden for privacy.'
    ]
  },
  {
    lookupNames: ['space enthusiast - yearly', 'space enthusiast yearly'],
    name: 'Space Enthusiast - Yearly (€19.99 + VAT)',
    amount: 19.99,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'enthusiast',
    tagline: 'Step inside the global space community and connect with fellow pioneers.',
    description: 'Step inside the global space community and connect with fellow pioneers (Annual).',
    ctaText: 'Join as Enthusiast (Annual)',
    badge: null,
    benefits: [
      'Start Free: Create and verify your profile, upload a photo, banner, and resume, browse the community directory, and connect via text chat and friend requests.',
      'Full Enthusiast Access: Unlimited text chat, voice calls, and video calls with your network.',
      'Save with annual billing.'
    ]
  },
  {
    lookupNames: ['space professional - monthly', 'space professional monthly'],
    name: 'Space Professional - Monthly (€9.99 + VAT)',
    amount: 9.99,
    type: 'community',
    category: 'community',
    billingCycle: 'Monthly',
    currency: 'EUR',
    requiredBadge: 'professional',
    tagline: 'Built for verified industry specialists ready to showcase their credentials and expand their reach.',
    description: 'Built for verified industry specialists ready to showcase their credentials and expand their reach.',
    ctaText: 'Join as Professional',
    badge: 'Verified Professional',
    benefits: [
      'Everything in Space Enthusiast: Unlimited text, voice, and video communication.',
      'Verified Professional Standing: Stand out to recruiters, partners, and peers with an officially vetted profile.',
      'Full Credential Showcase: Display academic, certification, and award history.',
      'Direct connection with aerospace decision-makers.'
    ]
  },
  {
    lookupNames: ['space professional - yearly', 'space professional yearly'],
    name: 'Space Professional - Yearly (€99 + VAT)',
    amount: 99,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'professional',
    tagline: 'Built for verified industry specialists ready to showcase their credentials and expand their reach.',
    description: 'Built for verified industry specialists ready to showcase their credentials and expand their reach (Annual).',
    ctaText: 'Join as Professional (Annual)',
    badge: 'Best Value',
    benefits: [
      'Everything in Space Enthusiast: Unlimited text, voice, and video communication.',
      'Verified Professional Standing: Stand out to recruiters, partners, and peers with an officially vetted profile.',
      'Full Credential Showcase: Display academic, certification, and award history.',
      'Direct connection with aerospace decision-makers.',
      'Save with annual billing.'
    ]
  },
  {
    lookupNames: ['space entrepreneur - monthly', 'space entrepreneur monthly'],
    name: 'Space Entrepreneur - Monthly (€19.99 + VAT)',
    amount: 19.99,
    type: 'community',
    category: 'community',
    billingCycle: 'Monthly',
    currency: 'EUR',
    requiredBadge: 'entrepreneur',
    tagline: 'Accelerate your venture with direct capital connections and tailored industry matchmaking.',
    description: 'Accelerate your venture with direct capital connections and tailored industry matchmaking.',
    ctaText: 'Join as Entrepreneur',
    badge: 'Capital Network',
    benefits: [
      'Everything in Space Professional: Unlimited communication and verified standing.',
      'Verified Capital Network: Connect directly with vetted business angels, VCs, investors, and financial institutions.',
      'Bespoke Talent & Funding Matches: Submit your funding or hiring needs, matched with the right investors, companies, and professionals.'
    ]
  },
  {
    lookupNames: ['space entrepreneur - yearly', 'space entrepreneur yearly'],
    name: 'Space Entrepreneur - Yearly (€199 + VAT)',
    amount: 199,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'entrepreneur',
    tagline: 'Accelerate your venture with direct capital connections and tailored industry matchmaking.',
    description: 'Accelerate your venture with direct capital connections and tailored industry matchmaking (Annual).',
    ctaText: 'Join as Entrepreneur (Annual)',
    badge: 'VIP Capital Network',
    benefits: [
      'Everything in Space Professional: Unlimited communication and verified standing.',
      'Verified Capital Network: Connect directly with vetted business angels, VCs, investors, and financial institutions.',
      'Bespoke Talent & Funding Matches: Submit your funding or hiring needs, matched with the right investors, companies, and professionals.',
      'Save with annual billing.'
    ]
  }
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    const existingPlans = await Plan.find();
    console.log(`Found ${existingPlans.length} existing plans in database.`);

    for (const planDef of plansData) {
      // Find matching plan by any of its lookupNames or exact name
      let matchedPlan = existingPlans.find(p => {
        const pName = p.name.toLowerCase();
        return planDef.lookupNames.some(l => pName.includes(l.toLowerCase())) ||
               pName === planDef.name.toLowerCase();
      });

      if (matchedPlan) {
        console.log(`Updating existing plan: "${matchedPlan.name}" -> "${planDef.name}" (€${planDef.amount})`);
        matchedPlan.name = planDef.name;
        matchedPlan.amount = planDef.amount;
        matchedPlan.type = planDef.type;
        matchedPlan.category = planDef.category;
        matchedPlan.billingCycle = planDef.billingCycle;
        matchedPlan.currency = planDef.currency;
        matchedPlan.tagline = planDef.tagline;
        matchedPlan.description = planDef.description;
        matchedPlan.ctaText = planDef.ctaText;
        matchedPlan.badge = planDef.badge;
        matchedPlan.requiredBadge = planDef.requiredBadge || 'none';
        matchedPlan.benefits = planDef.benefits;
        matchedPlan.isActive = true;
        await matchedPlan.save();
      } else {
        console.log(`Creating new plan: "${planDef.name}" (€${planDef.amount})`);
        const newPlan = new Plan({
          name: planDef.name,
          amount: planDef.amount,
          type: planDef.type,
          category: planDef.category,
          billingCycle: planDef.billingCycle,
          currency: planDef.currency,
          tagline: planDef.tagline,
          description: planDef.description,
          ctaText: planDef.ctaText,
          badge: planDef.badge,
          requiredBadge: planDef.requiredBadge || 'none',
          benefits: planDef.benefits,
          isActive: true
        });
        await newPlan.save();
      }
    }

    // Ensure all defined plans are active
    for (const planDef of plansData) {
      await Plan.updateMany(
        { name: planDef.name },
        { $set: { isActive: true } }
      );
    }

    // Explicitly deactivate only known legacy duplicate names
    const legacyExactNames = [
      'Basic SD All Access AVOD Monthly 1.99€ (+VAT/GST)',
      'Basic SD All Access AVOD Yearly (€19.99+VAT)',
      'Premium HD Monthly: 8.99€ (+VAT/GST)',
      'Premium HD Yearly 89€ (+VAT/GST)',
      'Premium+ 4K - Monthly (€9.99+VAT)',
      'Standard HD Yearly 59€ (+VAT/GST)',
      'Standard HD Monthly 5.99€ (+VAT/GST)',
      'Admin'
    ];
    for (const leg of legacyExactNames) {
      await Plan.updateMany(
        { name: leg },
        { $set: { isActive: false } }
      );
    }
    const finalPlans = await Plan.find().sort({ amount: 1 });
    console.log('\n--- FINAL PLANS IN DB ---');
    finalPlans.forEach(p => {
      console.log(`• [${p.category || p.type}] ${p.name} - €${p.amount} / ${p.billingCycle} (Badge: ${p.requiredBadge || 'none'})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

run();
