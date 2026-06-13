const express = require('express');
const router = express.Router();
const https = require('https');
const MediaAsset = require('../models/MediaAsset');
const SvpCache = require('../models/SvpCache');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// SVP Helpers & Caching
let cachedToken = null;
let tokenExpiresAt = null;

const SVP_API_KEY = 'apc-vDpDJvxyJvFn';
const SVP_API_CODE = 'apc-HHCEGDqFM2rK';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function getSvpToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  const tokenUrl = `https://www.streamingvideoprovider.com/?l=api&a=svp_auth_get_token&api_key=${SVP_API_KEY}&api_code=${SVP_API_CODE}&output=json`;
  const res = await fetchUrl(tokenUrl);
  
  let token;
  const match = res.data.match(/<auth_token>(.*?)<\/auth_token>/);
  if (match) {
    token = match[1];
  } else {
    try {
      const parsed = JSON.parse(res.data);
      token = parsed.auth_token || parsed.Token;
    } catch(e) {}
  }

  if (!token) {
    throw new Error('SVP Auth Token retrieval failed');
  }

  cachedToken = token;
  tokenExpiresAt = now + 24 * 60 * 60 * 1000; // 24 hours cache
  return token;
}

async function getSvpVideoRef(clipId) {
  let cacheEntry = await SvpCache.findOne({ clip_key: clipId });
  if (cacheEntry) {
    return cacheEntry.ref_no;
  }

  // Not in cache, fetch latest from SVP to update
  try {
    const token = await getSvpToken();
    const listUrl = `https://www.streamingvideoprovider.com/?l=api&token=${token}&a=svp_list_videos&output=json&limit=50&start=0`;
    const res = await fetchUrl(listUrl);
    
    const regex = /<video>([\s\S]*?)<\/video>/g;
    let m;
    const updates = [];
    let foundRefNo = null;

    while ((m = regex.exec(res.data)) !== null) {
      const titleM = m[1].match(/<title>(.*?)<\/title>/);
      const keyM = m[1].match(/<clip_key>(.*?)<\/clip_key>/);
      const refM = m[1].match(/<ref_no>(.*?)<\/ref_no>/);
      const sourceM = m[1].match(/<video_source>(.*?)<\/video_source>/);
      const streamM = m[1].match(/<stream_name>(.*?)<\/stream_name>/);
      const channelM = m[1].match(/<channel_ref>(.*?)<\/channel_ref>/);
      const durationM = m[1].match(/<duration>(.*?)<\/duration>/);
      const createdM = m[1].match(/<date_created>(.*?)<\/date_created>/);
      const modifiedM = m[1].match(/<date_modified>(.*?)<\/date_modified>/);
      const sizeM = m[1].match(/<file_size>(.*?)<\/file_size>/);
      const tagsBlockM = m[1].match(/<tags>([\s\S]*?)<\/tags>/);
      
      const tags = [];
      if (tagsBlockM) {
        const tagRegex = /<tag>(.*?)<\/tag>/g;
        let tm;
        while ((tm = tagRegex.exec(tagsBlockM[1])) !== null) {
          if (tm[1]) tags.push(tm[1].trim());
        }
      }

      if (keyM && refM) {
        updates.push({
          clip_key: keyM[1],
          ref_no: refM[1],
          title: titleM ? titleM[1] : 'Untitled',
          tags: tags,
          video_source: sourceM ? sourceM[1] : '',
          stream_name: streamM ? streamM[1] : '',
          channel_ref: channelM ? channelM[1] : '',
          duration: durationM ? Number(durationM[1]) : 0,
          date_created: createdM ? new Date(Number(createdM[1]) * 1000) : null,
          date_modified: modifiedM ? new Date(Number(modifiedM[1]) * 1000) : null,
          file_size: sizeM ? Number(sizeM[1]) : 0,
          lastUpdated: new Date()
        });
        if (keyM[1] === clipId) {
          foundRefNo = refM[1];
        }
      }
    }

    for (const update of updates) {
      await SvpCache.updateOne(
        { clip_key: update.clip_key },
        { $set: update },
        { upsert: true }
      );
    }

    return foundRefNo;
  } catch (err) {
    console.error('Failed to sync/lookup new SVP video in router:', err);
    return null;
  }
}

// Secure dynamic playback route
router.get('/playback/:clipId', async (req, res) => {
  try {
    const clipId = req.params.clipId;
    if (!clipId) return res.status(400).json({ msg: 'Missing clip ID' });

    const refNo = await getSvpVideoRef(clipId);
    if (!refNo) {
      return res.status(404).json({ msg: 'Video not found in catalog' });
    }

    const token = await getSvpToken();
    const hlsUrl = `https://www.streamingvideoprovider.com/?l=api&token=${token}&a=svp_get_hls_url&video_ref=${refNo}`;
    const hlsRes = await fetchUrl(hlsUrl);

    const matchUrl = hlsRes.data.match(/<video_url>(.*?)<\/video_url>/);
    if (matchUrl && matchUrl[1]) {
      if (req.query.format === 'json') {
        return res.json({ url: matchUrl[1] });
      }
      return res.redirect(302, matchUrl[1]);
    } else {
      console.error('SVP HLS response error:', hlsRes.data);
      return res.status(500).json({ msg: 'Failed to retrieve stream URL from provider' });
    }
  } catch (err) {
    console.error('Playback proxy error:', err.message);
    res.status(500).json({ msg: 'Server error during playback resolution' });
  }
});

function formatAsset(asset, req) {
  if (!asset) return null;
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const json = asset.toJSON ? asset.toJSON() : asset;

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (json.images && json.images.length > 0) {
    json.images = json.images.map(img => {
      if (!img) return img;

      // Normalize any localhost URL stored in DB back to canonical prod URL
      const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\//;
      if (localhostPattern.test(img)) {
        img = img.replace(localhostPattern, 'https://api.interplanetary.tv/api/');
      }

      // In local: rewrite prod URL to public VPS IP since domain DNS doesn't resolve
      if (isLocal && img.startsWith('https://api.interplanetary.tv/api/')) {
        return img.replace('https://api.interplanetary.tv/api/', 'http://91.98.150.199/api/');
      }

      // In production: rewrite prod URL to current domain
      if (!isLocal && img.startsWith('https://api.interplanetary.tv/api/')) {
        return img.replace('https://api.interplanetary.tv/api/', `${baseUrl}/api/`);
      }

      return img;
    });
  }

  return json;
}

// Get all media assets
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.query.type) {
      query.type = req.query.type;
    }
    const assets = await MediaAsset.find(query).sort({ createdAt: -1 });
    res.json(assets.map(asset => formatAsset(asset, req)));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get single media asset by ID
router.get('/:id', async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Media Asset not found' });
    res.json(formatAsset(asset, req));
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Media Asset not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create media asset (Admin only)
router.post('/', [auth, admin], async (req, res) => {
  try {
    const newAsset = new MediaAsset(req.body);
    const asset = await newAsset.save();
    res.json(formatAsset(asset, req));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete media asset (Admin only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Media Asset not found' });
    await asset.deleteOne();
    res.json({ msg: 'Media Asset removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update media asset (Admin only)
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Media Asset not found' });
    const updated = await MediaAsset.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(formatAsset(updated, req));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Increment view count (Public)
router.put('/:id/view', async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Media Asset not found' });
    asset.views = (asset.views || 0) + 1;
    await asset.save();
    res.json({ views: asset.views });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Toggle Like (Auth required)
router.put('/:id/like', auth, async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Media Asset not found' });

    const index = asset.likes.indexOf(req.user.id);
    if (index === -1) {
      asset.likes.push(req.user.id);
    } else {
      asset.likes.splice(index, 1);
    }
    await asset.save();
    res.json(asset.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
