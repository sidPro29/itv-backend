require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const MediaAsset = require('../models/MediaAsset');

function decodeHtml(text) {
  if (!text) return text;
  // Cheerio automatically decodes HTML entities when using .text()
  // We wrap in a generic div to parse safely
  const decoded = cheerio.load(`<div>${text}</div>`)('div').text();
  return decoded;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const assets = await MediaAsset.find({});
  let updatedCount = 0;
  let stats = {
    titleCleaned: 0,
    descriptionCleaned: 0
  };

  for (let asset of assets) {
    let modified = false;

    // Clean Title
    if (asset.title && /&[a-zA-Z0-9#]+;/.test(asset.title)) {
      const cleanTitle = decodeHtml(asset.title);
      if (cleanTitle !== asset.title) {
        asset.title = cleanTitle;
        stats.titleCleaned++;
        modified = true;
      }
    }

    // Clean Description
    if (asset.description && /&[a-zA-Z0-9#]+;/.test(asset.description)) {
      const cleanDesc = decodeHtml(asset.description);
      if (cleanDesc !== asset.description) {
        asset.description = cleanDesc;
        stats.descriptionCleaned++;
        modified = true;
      }
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
