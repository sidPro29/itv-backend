require('dotenv').config();
const crypto = require('crypto');
if (!global.crypto) {
  global.crypto = crypto;
}
const mongoose = require('mongoose');
const Plan = require('../models/Plan');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/itv';

const plansData = [
  // ==========================================
  // PART 1: VIEWER / STREAMING PLANS (B2C)
  // ==========================================
  {
    lookupNames: ['explorer (basic sd) - monthly', 'explorer (basic sd)', 'basic sd all access avod monthly'],
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
    lookupNames: ['explorer (basic sd) - yearly', 'basic sd all access avod yearly'],
    name: 'Explorer (Basic SD) - Yearly',
    amount: 19.90,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Essential space entertainment on a budget (Annual Plan - 2 Months Free).',
    description: 'Essential space entertainment on a budget.',
    ctaText: 'Start Exploring (Annual)',
    badge: 'Save 17%',
    benefits: [
      'Standard Definition (SD) streaming across supported devices.',
      'Full access to our core library of space documentaries, sci-fi series, and indie films.',
      'Ad-supported streaming experience.',
      'Save with annual billing (2 months free).'
    ]
  },

  {
    lookupNames: ['navigator (standard hd) - monthly', 'navigator (standard hd)', 'standard hd monthly'],
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
    lookupNames: ['navigator (standard hd) - yearly', 'standard hd yearly'],
    name: 'Navigator (Standard HD) - Yearly',
    amount: 59.90,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Crisp high-definition streaming for true space enthusiasts (Annual Plan).',
    description: 'Crisp high-definition streaming for true space enthusiasts.',
    ctaText: 'Choose Navigator (Annual)',
    badge: 'Most Popular',
    benefits: [
      'Crystal-clear High Definition (HD) playback.',
      'Expanded access to featured films, news segments, and special releases.',
      'Uninterrupted, streamlined viewing experience.',
      'Save with annual billing (2 months free).'
    ]
  },

  {
    lookupNames: ['commander (premium hd) - monthly', 'commander (premium hd)', 'premium hd monthly'],
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
      'Multi-device streaming support.',
      'Full access to the ITV Space Community Platform.'
    ]
  },
  {
    lookupNames: ['commander (premium hd) - yearly', 'premium hd yearly'],
    name: 'Commander (Premium HD) - Yearly',
    amount: 89.90,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'The ultimate HD viewing experience with priority access (Annual Plan).',
    description: 'The ultimate HD viewing experience with priority access.',
    ctaText: 'Go Commander (Annual)',
    badge: 'Recommended',
    benefits: [
      'Premium High Definition streaming with enhanced audio depth.',
      'Priority access to live space mission broadcasts and exclusive premieres.',
      'Multi-device streaming support.',
      'Full access to the ITV Space Community Platform.',
      'Save with annual billing (2 months free).'
    ]
  },

  {
    lookupNames: ['cosmonaut (premium+ 4k ultra hd) - monthly', 'cosmonaut (premium+ 4k ultra hd)', 'premium+ 4k monthly'],
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
      'Early access to original documentaries, director cuts, and high-end science features.',
      'Multi-screen streaming access across all supported devices.'
    ]
  },
  {
    lookupNames: ['cosmonaut (premium+ 4k ultra hd) - yearly', 'premium+ 4k yearly'],
    name: 'Cosmonaut (Premium+ 4K Ultra HD) - Yearly',
    amount: 99.90,
    type: 'regular',
    category: 'viewer',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Breathtaking cinematic immersion in stunning 4K resolution (Annual Plan).',
    description: 'Breathtaking cinematic immersion in stunning 4K resolution.',
    ctaText: 'Unlock 4K Ultra (Annual)',
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
    lookupNames: ['creator launchpad (1 ad slot) - monthly', 'creator launchpad (1 ad slot)', 'blogger 1 ad plan'],
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
    lookupNames: ['creator launchpad (1 ad slot) - yearly'],
    name: 'Creator Launchpad (1 Ad Slot) - Yearly',
    amount: 1990,
    type: 'adsPlan',
    category: 'creator',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Kickstart your brand presence within a targeted space community (Annual Plan).',
    description: 'Kickstart your brand presence within a targeted space community.',
    ctaText: 'Launch Campaign (Annual)',
    badge: 'Annual Savings',
    benefits: [
      '1 dedicated promotional ad placement across iTV streaming segments for 12 months.',
      'Ideal for independent creators, authors, and niche educators.',
      'Standard audience analytics and reporting.',
      '10x Monthly Price: 2 months completely free.'
    ]
  },

  {
    lookupNames: ['creator orbit (2 ad slots) - monthly', 'creator orbit (2 ad slots)', 'blogger 2 ad plan'],
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
  {
    lookupNames: ['creator orbit (2 ad slots) - yearly'],
    name: 'Creator Orbit (2 Ad Slots) - Yearly',
    amount: 2990,
    type: 'adsPlan',
    category: 'creator',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Double your impact and reach engaged science-fiction & science fans (Annual Plan).',
    description: 'Double your impact and reach engaged science-fiction & science fans.',
    ctaText: 'Expand Reach (Annual)',
    badge: 'Popular for Creators',
    benefits: [
      '2 concurrent promotional ad placements across high-traffic inventory for 12 months.',
      'Enhanced visibility rotation during peak viewing hours.',
      'Monthly performance insights to optimize conversion.',
      '10x Monthly Price: 2 months completely free.'
    ]
  },

  // ==========================================
  // PART 3: SMALL BUSINESS ADVERTISING (B2B)
  // ==========================================
  {
    lookupNames: ['enterprise spark (single ad tier) - monthly', 'enterprise spark (single ad tier)', 'small business 1 ad plan'],
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
    lookupNames: ['enterprise spark (single ad tier) - yearly'],
    name: 'Enterprise Spark (Single Ad Tier) - Yearly',
    amount: 9990,
    type: 'adsPlan',
    category: 'smallBusiness',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Direct brand integration for growing businesses in tech and science (Annual Plan).',
    description: 'Direct brand integration for growing businesses in tech and science.',
    ctaText: 'Partner with Us (Annual)',
    badge: 'Annual Enterprise',
    benefits: [
      'Premium placement for 1 core promotional asset for 12 full months.',
      'Reaches dedicated tech-forward and space-enthusiast audiences globally.',
      'Dedicated campaign support and impression tracking.',
      '10x Monthly Price: 2 months completely free.'
    ]
  },

  {
    lookupNames: ['enterprise nebula (dual ad tier) - monthly', 'enterprise nebula (dual ad tier)', 'small business 2 ad plan'],
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
  {
    lookupNames: ['enterprise nebula (dual ad tier) - yearly'],
    name: 'Enterprise Nebula (Dual Ad Tier) - Yearly',
    amount: 19990,
    type: 'adsPlan',
    category: 'smallBusiness',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Wider coverage and robust visibility across multiple iTV channels (Annual Plan).',
    description: 'Wider coverage and robust visibility across multiple iTV channels.',
    ctaText: 'Accelerate Growth (Annual)',
    badge: 'High Impact',
    benefits: [
      '2 high-impact ad placements tailored for scaling businesses for 12 months.',
      'Priority scheduling across selected documentary and news categories.',
      'Comprehensive analytics dashboard access.',
      '10x Monthly Price: 2 months completely free.'
    ]
  },

  // ==========================================
  // PART 4: CORPORATE BUSINESS ADVERTISING (B2B)
  // ==========================================
  {
    lookupNames: ['galactic horizon (primary corporate) - monthly', 'galactic horizon (primary corporate)', 'business 1 ad plan'],
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
    lookupNames: ['galactic horizon (primary corporate) - yearly'],
    name: 'Galactic Horizon (Primary Corporate) - Yearly',
    amount: 29990,
    type: 'adsPlan',
    category: 'corporate',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Substantial brand exposure for industry leaders and major innovators (Annual Plan).',
    description: 'Substantial brand exposure for industry leaders and major innovators.',
    ctaText: 'Secure Horizon (Annual)',
    badge: 'Corporate Partner',
    benefits: [
      'High-frequency primary ad placement across premium network programming for 12 months.',
      'Custom demographic targeting within space exploration and tech sectors.',
      'Dedicated account management and campaign optimization.',
      '10x Monthly Price: 2 months completely free.'
    ]
  },

  {
    lookupNames: ['cosmic syndicate (elite corporate sponsorship) - monthly', 'cosmic syndicate (elite corporate sponsorship)', 'business 2 ad plan'],
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
  {
    lookupNames: ['cosmic syndicate (elite corporate sponsorship) - yearly'],
    name: 'Cosmic Syndicate (Elite Corporate Sponsorship) - Yearly',
    amount: 49990,
    type: 'adsPlan',
    category: 'corporate',
    billingCycle: 'Yearly',
    currency: 'EUR',
    tagline: 'Ultimate network-wide dominance and premium title sponsorship integration (Annual Plan).',
    description: 'Ultimate network-wide dominance and premium title sponsorship integration.',
    ctaText: 'Claim Elite Status (Annual)',
    badge: 'Enterprise Elite',
    benefits: [
      'Maximum share of voice with dual premium corporate ad slots for 12 months.',
      'Exclusive brand feature opportunities alongside major live broadcasts and docu-series.',
      'Full-suite enterprise analytics, custom reporting, and priority placement.',
      '10x Monthly Price: 2 months completely free.'
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
    name: 'Space Enthusiast - Yearly (€19.90 + VAT)',
    amount: 19.90,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'enthusiast',
    tagline: 'Step inside the global space community and connect with fellow pioneers (Annual Plan).',
    description: 'Step inside the global space community and connect with fellow pioneers.',
    ctaText: 'Join as Enthusiast (Annual)',
    badge: 'Save 17%',
    benefits: [
      'Start Free: Create and verify your profile, upload a photo, banner, and resume, browse the community directory, and connect via text chat and friend requests.',
      'Full Enthusiast Access: Unlimited text chat, voice calls, and video calls with your network.',
      'Save with annual billing: 10x monthly price (2 months free).'
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
    name: 'Space Professional - Yearly (€99.90 + VAT)',
    amount: 99.90,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'professional',
    tagline: 'Built for verified industry specialists ready to showcase their credentials and expand their reach (Annual Plan).',
    description: 'Built for verified industry specialists ready to showcase their credentials and expand their reach.',
    ctaText: 'Join as Professional (Annual)',
    badge: 'Best Value',
    benefits: [
      'Everything in Space Enthusiast: Unlimited text, voice, and video communication.',
      'Verified Professional Standing: Stand out to recruiters, partners, and peers with an officially vetted profile.',
      'Full Credential Showcase: Display academic, certification, and award history.',
      'Direct connection with aerospace decision-makers.',
      'Save with annual billing: 10x monthly price (2 months free).'
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
    name: 'Space Entrepreneur - Yearly (€199.90 + VAT)',
    amount: 199.90,
    type: 'community',
    category: 'community',
    billingCycle: 'Yearly',
    currency: 'EUR',
    requiredBadge: 'entrepreneur',
    tagline: 'Accelerate your venture with direct capital connections and tailored industry matchmaking (Annual Plan).',
    description: 'Accelerate your venture with direct capital connections and tailored industry matchmaking.',
    ctaText: 'Join as Entrepreneur (Annual)',
    badge: 'VIP Capital Network',
    benefits: [
      'Everything in Space Professional: Unlimited communication and verified standing.',
      'Verified Capital Network: Connect directly with vetted business angels, VCs, investors, and financial institutions.',
      'Bespoke Talent & Funding Matches: Submit your funding or hiring needs, matched with the right investors, companies, and professionals.',
      'Save with annual billing: 10x monthly price (2 months free).'
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
      // Find matching plan by exact name or lookupNames
      let matchedPlan = existingPlans.find(p => {
        const pName = p.name.toLowerCase();
        return pName === planDef.name.toLowerCase() ||
               (planDef.lookupNames && planDef.lookupNames.some(l => pName === l.toLowerCase() || pName.includes(l.toLowerCase())));
      });

      if (matchedPlan) {
        console.log(`Updating existing plan: "${matchedPlan.name}" -> "${planDef.name}" (€${planDef.amount} / ${planDef.billingCycle})`);
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
        console.log(`Creating new plan: "${planDef.name}" (€${planDef.amount} / ${planDef.billingCycle})`);
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

    // Explicitly deactivate only known legacy duplicate names
    const legacyExactNames = [
      'Basic SD All Access AVOD Monthly 1.99€ (+VAT/GST)',
      'Basic SD All Access AVOD Yearly (€19.99+VAT)',
      'Premium HD Monthly: 8.99€ (+VAT/GST)',
      'Premium HD Yearly 89€ (+VAT/GST)',
      'Premium+ 4K - Monthly (€9.99+VAT)',
      'Standard HD Yearly 59€ (+VAT/GST)',
      'Standard HD Monthly 5.99€ (+VAT/GST)',
      'Blogger 1 Ad Plan - Monthly - 199 Eur. (+VAT/GST)',
      'Blogger 2 Ad Plan - Monthly (€299+VAT)',
      'Small Business 1 Ad Plan - Monthly - 999 (+VAT/GST)',
      'Small Business 2 Ad Plan - Monthly - 1999 Eur. (+VAT/GST)',
      'Business 1 Ad Plan - Monthly (€2999+VAT)',
      'Business 2 Ad Plan - Monthly: 4999 Eur. (+VAT/GST)',
      'Admin'
    ];
    for (const leg of legacyExactNames) {
      await Plan.updateMany(
        { name: leg },
        { $set: { isActive: false } }
      );
    }

    console.log('\nAll plans successfully synced in database!');
    const finalPlans = await Plan.find({ isActive: true }).sort({ type: 1, amount: 1 });
    console.log(`\n--- ACTIVE PLANS IN DB (${finalPlans.length} Total) ---`);
    finalPlans.forEach(p => {
      console.log(`• [${p.type}] [${p.category || 'N/A'}] ${p.name} - €${p.amount} / ${p.billingCycle}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

run();
