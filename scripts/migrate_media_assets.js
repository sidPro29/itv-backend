/**
 * Migration: Restructure MediaAsset video/trailer fields
 *
 * For every document in mediaassets collection:
 *  - Move svp_clip_id  → videos.clipId
 *  - Move svp_ref_no   → videos.svpRefNo
 *  - Convert videoUrl[] →
 *      YouTube URL → videos.youtube
 *      Others      → videos['non-svp-1'], videos['non-svp-2'], ...
 *  - Remove old fields: videoUrl, trailerUrl, svp_clip_id, svp_ref_no
 *
 * Run for LOCAL:
 *   node scripts/migrate_media_assets.js local
 *
 * Run for PROD:
 *   node scripts/migrate_media_assets.js prod
 */

const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/itv';
const PROD_URI  = 'mongodb+srv://sidv6213:Hello1234@cluster0.pgdilqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const DB_NAME = 'test'; // Change if your DB name is different

function isYouTube(url) {
  return typeof url === 'string' && /(?:youtube\.com|youtu\.be)/i.test(url);
}

async function migrate(uri, label) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(`\n✅ Connected to ${label} DB`);

    // Try common db names
    const allDbs = await client.db().admin().listDatabases();
    const dbNames = allDbs.databases.map(d => d.name);
    console.log('Available DBs:', dbNames);

    // Pick the right DB
    const possibleNames = ['test', 'sample_mflix', 'itv-cms', 'itv'];
    let db = null;
    for (const name of possibleNames) {
      if (dbNames.includes(name)) {
        const candidate = client.db(name);
        const cols = await candidate.listCollections({ name: 'mediaassets' }).toArray();
        if (cols.length > 0) {
          db = candidate;
          console.log(`📂 Using DB: "${name}"`);
          break;
        }
      }
    }

    if (!db) {
      console.log(`⚠️  Could not find 'mediaassets' collection in any known DB on ${label}.`);
      return;
    }

    const col = db.collection('mediaassets');
    const docs = await col.find({}).toArray();
    console.log(`📦 Found ${docs.length} documents in ${label}`);

    let updated = 0;
    let skipped = 0;

    for (const doc of docs) {
      const videosObj = doc.videos && typeof doc.videos === 'object' && !Array.isArray(doc.videos)
        ? { ...doc.videos }
        : {};
      const trailerObj = doc.trailer && typeof doc.trailer === 'object' && !Array.isArray(doc.trailer)
        ? { ...doc.trailer }
        : {};

      let changed = false;

      // 1. Move svp_clip_id → videos.clipId
      if (doc.svp_clip_id && !videosObj.clipId) {
        videosObj.clipId = doc.svp_clip_id;
        changed = true;
      }

      // 2. Move svp_ref_no → videos.svpRefNo
      if (doc.svp_ref_no && !videosObj.svpRefNo) {
        videosObj.svpRefNo = doc.svp_ref_no;
        changed = true;
      }

      // 3. Convert videoUrl[] → videos['youtube'] / videos['non-svp-N']
      if (doc.videoUrl && Array.isArray(doc.videoUrl) && doc.videoUrl.length > 0) {
        let nonSvpCounter = 1;
        for (const url of doc.videoUrl) {
          if (!url || !url.trim()) continue;
          if (isYouTube(url)) {
            if (!videosObj.youtube) {
              videosObj.youtube = url.trim();
            }
          } else {
            const key = `non-svp-${nonSvpCounter++}`;
            videosObj[key] = url.trim();
          }
        }
        changed = true;
      }

      const unsetFields = {
        videoUrl: '',
        trailerUrl: '',
        svp_clip_id: '',
        svp_ref_no: '',
        videoUrls: '', // remove virtual remnant if accidentally persisted
      };

      if (!changed && Object.keys(videosObj).length === 0 && Object.keys(trailerObj).length === 0) {
        skipped++;
        continue;
      }

      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            videos: videosObj,
            trailer: trailerObj,
          },
          $unset: unsetFields,
        }
      );

      console.log(`  ✔ Migrated: "${doc.title}" (${doc._id})`);
      updated++;
    }

    console.log(`\n🎉 ${label} migration complete: ${updated} updated, ${skipped} skipped (already clean)\n`);
  } catch (err) {
    console.error(`❌ Error on ${label}:`, err.message);
  } finally {
    await client.close();
  }
}

async function main() {
  const target = process.argv[2]; // 'local' | 'prod' | 'both'

  if (!target || !['local', 'prod', 'both'].includes(target)) {
    console.log('Usage: node scripts/migrate_media_assets.js [local|prod|both]');
    process.exit(1);
  }

  if (target === 'local' || target === 'both') {
    await migrate(LOCAL_URI, 'LOCAL');
  }
  if (target === 'prod' || target === 'both') {
    await migrate(PROD_URI, 'PROD');
  }
}

main().catch(console.error);
