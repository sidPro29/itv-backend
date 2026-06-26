const mongoose = require('mongoose');
globalThis.crypto = require("crypto").webcrypto;

const MONGODB_URI = 'mongodb://mongodb:27017/interplanetary_tv';

const ArticleSchema = new mongoose.Schema({}, { strict: false });
const Article = mongoose.model('Article', ArticleSchema);

const MediaAssetSchema = new mongoose.Schema({}, { strict: false });
const MediaAsset = mongoose.model('MediaAsset', MediaAssetSchema);

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  // Migrate Articles
  const articles = await Article.find();
  let articleCount = 0;
  for (const article of articles) {
    let updated = false;
    let newImageUrl = article.get('imageUrl');
    let newImages = article.get('images') || [];

    if (newImageUrl && newImageUrl.includes('http://91.98.150.199')) {
      newImageUrl = newImageUrl.replace('http://91.98.150.199', 'https://api.interplanetary.tv');
      updated = true;
    }

    for (let i = 0; i < newImages.length; i++) {
      if (newImages[i] && newImages[i].includes('http://91.98.150.199')) {
        newImages[i] = newImages[i].replace('http://91.98.150.199', 'https://api.interplanetary.tv');
        updated = true;
      }
    }

    if (updated) {
      await Article.updateOne({ _id: article._id }, { $set: { imageUrl: newImageUrl, images: newImages } });
      articleCount++;
    }
  }

  // Migrate MediaAssets
  const mediaAssets = await MediaAsset.find();
  let mediaCount = 0;
  for (const asset of mediaAssets) {
    let updated = false;
    let newImages = asset.get('images') || [];
    let newThumbnails = asset.get('thumbnails') || [];

    for (let i = 0; i < newImages.length; i++) {
      if (newImages[i] && newImages[i].includes('http://91.98.150.199')) {
        newImages[i] = newImages[i].replace('http://91.98.150.199', 'https://api.interplanetary.tv');
        updated = true;
      }
    }

    for (let i = 0; i < newThumbnails.length; i++) {
      if (newThumbnails[i] && newThumbnails[i].includes('http://91.98.150.199')) {
        newThumbnails[i] = newThumbnails[i].replace('http://91.98.150.199', 'https://api.interplanetary.tv');
        updated = true;
      }
    }

    if (updated) {
      await MediaAsset.updateOne({ _id: asset._id }, { $set: { images: newImages, thumbnails: newThumbnails } });
      mediaCount++;
    }
  }

  console.log(`Migrated ${articleCount} articles and ${mediaCount} media assets to HTTPS domains.`);
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
