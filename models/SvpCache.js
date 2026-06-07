const mongoose = require('mongoose');

const SvpCacheSchema = new mongoose.Schema({
  clip_key: { type: String, unique: true, required: true },
  ref_no: { type: String, required: true },
  title: { type: String },
  tags: [{ type: String }],
  video_source: { type: String },
  stream_name: { type: String },
  channel_ref: { type: String },
  duration: { type: Number },
  date_created: { type: Date },
  date_modified: { type: Date },
  file_size: { type: Number },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SvpCache', SvpCacheSchema);
