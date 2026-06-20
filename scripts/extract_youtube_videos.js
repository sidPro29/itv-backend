const mongoose = require('mongoose');
require('dotenv').config();
const Article = require('../models/Article');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/itv');
  console.log("Fetching posts from WP to extract YouTube URLs...");
  const res = await fetch('https://interplanetary.tv/wp-json/wp/v2/posts?per_page=100');
  const posts = await res.json();
  
  let updatedCount = 0;
  for (const post of posts) {
     // match all possible youtube links
     const ytMatch = post.content.rendered.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{10,12})/i);
     if (ytMatch) {
        const videoUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        const title = post.title.rendered.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&#038;/g, "&");
        
        const words = title.split(' ').slice(0, 3).join(' ');
        const existing = await Article.findOne({ title: { $regex: new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
        if (existing && existing.videoUrl !== videoUrl) {
            existing.videoUrl = videoUrl;
            await existing.save();
            console.log(`Updated videoUrl for: ${existing.title} -> ${videoUrl}`);
            updatedCount++;
        }
     }
  }
  console.log(`Updated ${updatedCount} articles with YouTube videos.`);
  process.exit();
}
run();
