require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const MediaAsset = require('../models/MediaAsset');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const assets = await MediaAsset.find({});
  let updatedCount = 0;
  const stats = {
    viewsExtracted: 0,
    cleanDescriptionUpdated: 0,
    videoUrlExtracted: 0,
    clipIdExtracted: 0,
    referenceLinksAdded: 0
  };

  for (let asset of assets) {
    let modified = false;
    let oldDesc = asset.description;

    if (!oldDesc) continue;

    // Load HTML description
    const $ = cheerio.load(oldDesc);

    // 1. Extract Views
    const textContent = $('body').text();
    const viewsMatch = textContent.match(/Views:\s*(\d+)/i);
    if (viewsMatch) {
      const views = parseInt(viewsMatch[1], 10);
      if (asset.views !== views) {
        asset.views = views;
        stats.viewsExtracted++;
        modified = true;
      }
      // Remove the views element from DOM so it won't appear in clean text
      $('*:contains("Views: ' + viewsMatch[1] + '")').each(function() {
        if ($(this).children().length === 0 && $(this).text().trim() === 'Views: ' + viewsMatch[1]) {
          $(this).remove();
        }
      });
      // Fallback: simply replace it in the final text
    }

    // 2. Extract Video URLs
    const videoSources = [];
    $('video').each((i, el) => {
      const src = $(el).attr('src');
      if (src) videoSources.push(src);
    });

    if (videoSources.length > 0) {
      if (!asset.videos) asset.videos = {};
      const existingUrls = Object.values(asset.videos).filter(v => typeof v === 'string' && v.startsWith('http'));
      
      let addedAny = false;
      for (const src of videoSources) {
        if (!existingUrls.includes(src)) {
          let i = 1;
          while (asset.videos[`non-svp-${i}`]) i++;
          asset.videos[`non-svp-${i}`] = src;
          existingUrls.push(src);
          addedAny = true;
          modified = true;
        }
      }
      if (addedAny) stats.videoUrlExtracted++;
      if (addedAny) asset.markModified('videos');
    }

    // 3. Extract clip ID if missing
    if (!asset.videos || !asset.videos.clipId) {
      const clipIdMatch = oldDesc.match(/\[svpVideo\s+v=["']?([^"']+)["']?\]/i) || 
                          oldDesc.match(/clip_id=["']?([^"']+)["']?/i) ||
                          oldDesc.match(/clipId[\s=:]+([a-zA-Z0-9_-]+)/i);
      
      if (clipIdMatch) {
        if (!asset.videos) asset.videos = {};
        asset.videos.clipId = clipIdMatch[1];
        asset.markModified('videos');
        stats.clipIdExtracted++;
        modified = true;
      }
    }

    // 4. Extract Author & External Links
    const links = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && href.startsWith('http')) {
        links.push({ text, url: href });
      }
    });

    if (links.length > 0) {
      const existingHrefs = (asset.reference_links || []).map(l => l.url);
      const newLinks = links.filter(l => !existingHrefs.includes(l.url));
      
      if (newLinks.length > 0) {
        asset.reference_links = [...(asset.reference_links || []), ...newLinks];
        stats.referenceLinksAdded++;
        modified = true;
      }
    }

    // 5. Clean Description
    $('script, style, iframe, video, .elementor-custom-embed-image-overlay').remove();
    
    let cleanText = '';
    $('p, h1, h2, h3, h4, h5, h6, blockquote, li').each((i, el) => {
      const pText = $(el).text().trim();
      if (pText && !pText.match(/^Views:\s*\d+$/i)) {
        cleanText += pText + '\n\n';
      }
    });

    if (!cleanText) {
      cleanText = $('body').text().trim();
    }

    // Remove any leftover "Views: X" string
    if (viewsMatch) {
      cleanText = cleanText.replace(new RegExp(`Views:\\s*${viewsMatch[1]}`, 'gi'), '');
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

    // Ensure we don't update if it's already clean
    if (cleanText && cleanText !== asset.description) {
      asset.description = cleanText;
      stats.cleanDescriptionUpdated++;
      modified = true;
    }

    if (modified) {
      await asset.save();
      updatedCount++;
    }
  }

  console.log(`\nUpdated ${updatedCount} documents.`);
  console.log('Stats:', stats);
  process.exit(0);
}

run().catch(console.error);
