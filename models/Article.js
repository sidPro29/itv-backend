const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String },
  description: { type: String, required: true },
  images: [{ type: String }],
  imageUrl: { type: String },
  videoUrl: { type: String },
  keywords: [{ type: String }],
  publishedDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', ArticleSchema);
