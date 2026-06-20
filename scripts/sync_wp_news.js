const mongoose = require('mongoose');
require('dotenv').config();
const Article = require('../models/Article');
const cheerio = require('cheerio');

function decodeHtml(text) {
  if (!text) return text;
  return cheerio.load(`<div>${text}</div>`)('div').text();
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/itv');
  console.log("Fetching latest posts from WP...");
  const res = await fetch('https://interplanetary.tv/wp-json/wp/v2/posts?per_page=20&_embed=1');
  const posts = await res.json();
  console.log(`Fetched ${posts.length} posts from WP.`);

  let newCount = 0;
  for (const post of posts) {
    let title = post.title.rendered.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&#038;/g, "&");
    const existing = await Article.findOne({ title: { $regex: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    
    if (!existing) {
       console.log("Adding NEW: " + title);
       
       let imageUrl = '';
       if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
           imageUrl = post._embedded['wp:featuredmedia'][0].source_url;
       }
       
       // get raw HTML content
       let content = post.content.rendered;
       
       const newArticle = new Article({
           title: decodeHtml(post.title.rendered),
           description: content,
           images: imageUrl ? [imageUrl] : [],
           imageUrl: imageUrl,
           publishedDate: new Date(post.date),
           createdAt: new Date(post.date)
       });
       
       await newArticle.save();
       newCount++;
    }
  }
  
  console.log(`Successfully added ${newCount} new articles.`);
  process.exit();
}

run().catch(console.error);
