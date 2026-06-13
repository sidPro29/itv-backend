const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String },
  description: { type: String, required: true },
  images: [{ type: String }],
  imageUrl: { type: String },
  videoUrl: { type: String },
  keywords: [{ type: String }],
  views: { type: Number, default: 0 },
  author: { type: String },
  author_bio: { type: String },
  credits: { type: mongoose.Schema.Types.Mixed },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  publishedDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', ArticleSchema);
