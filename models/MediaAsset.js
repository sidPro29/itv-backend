const mongoose = require('mongoose');

const MediaAssetSchema = new mongoose.Schema({
  wp_asset_id: { type: Number },
  type: { type: String, enum: ['video', 'tvshow', 'movie', 'episode', 'movies', 'tvshows'], required: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String },
  description: { type: String, required: true },
  images: [{ type: String }],
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reference_links: [{
    text: String,
    url: String
  }],

  // videos object – stores dynamic keys: clipId, svpRefNo, youtube, non-svp-1, non-svp-2, ...
  videos: { type: mongoose.Schema.Types.Mixed, default: {} },

  // trailer object – same dynamic structure
  trailer: { type: mongoose.Schema.Types.Mixed, default: {} },

  program: {
    programName: String,
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' }
  },
  languages: [{ type: String }],
  genres: [{ type: String }],
  tags: [{ type: String }],
  membership_level: [{
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: String
  }],
  publishedDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('MediaAsset', MediaAssetSchema);
