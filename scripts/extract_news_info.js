require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const Article = require('../models/Article');

function decodeHtml(text) {
  if (!text) return text;
  return cheerio.load(`<div>${text}</div>`)('div').text();
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const articles = await Article.find({});
  let updatedCount = 0;
  let stats = {
    viewsExtracted: 0,
    creditsExtracted: 0,
    authorBioExtracted: 0,
    linksHyperlinked: 0,
    descriptionCleaned: 0,
    titleCleaned: 0
  };

  for (let article of articles) {
    let modified = false;

    // Clean Title
    if (article.title && /&[a-zA-Z0-9#]+;/.test(article.title)) {
      const cleanTitle = decodeHtml(article.title);
      if (cleanTitle !== article.title) {
        article.title = cleanTitle;
        stats.titleCleaned++;
        modified = true;
      }
    }

    let text = article.description || '';
    if (!text) continue;

    // Decode HTML entities (e.g. &amp; -> &) and strip accidental HTML
    const originalText = text;
    text = decodeHtml(text);
    if (text !== originalText) {
      modified = true;
    }

    // 1. Extract Views
    const viewsMatch = text.match(/Views:\s*(\d+)/i);
    if (viewsMatch) {
      const views = parseInt(viewsMatch[1], 10);
      if (article.views !== views) {
        article.views = views;
        stats.viewsExtracted++;
        modified = true;
      }
      text = text.replace(new RegExp(`Views:\\s*${viewsMatch[1]}`, 'gi'), '').trim();
    }

    // 2. Extract Credits
    // Match something like "- by Frederic Eger, Interplanetary.tv - Photo credit: AI generated - Video credit: ILTV"
    const creditsRegex = /-\s*by\s+([^,-]+)(?:,\s*([^-\n]+))?\s*(?:-\s*Photo credit:\s*([^-\n]+))?\s*(?:-\s*Video credit:\s*([^-\n]+))?/i;
    const creditsMatch = text.match(creditsRegex);
    if (creditsMatch) {
      if (!article.credits) article.credits = {};
      
      const author = creditsMatch[1] ? creditsMatch[1].trim() : null;
      const org = creditsMatch[2] ? creditsMatch[2].trim() : null;
      const photoCredit = creditsMatch[3] ? creditsMatch[3].trim() : null;
      const videoCredit = creditsMatch[4] ? creditsMatch[4].trim() : null;
      
      if (author) {
        article.author = author;
        article.credits.author = author;
      }
      if (org) article.credits.organization = org;
      if (photoCredit) article.credits.photoCredit = photoCredit;
      if (videoCredit) article.credits.videoCredit = videoCredit;
      
      article.markModified('credits');
      stats.creditsExtracted++;
      modified = true;
      
      // Remove credits line from text
      text = text.replace(creditsMatch[0], '').trim();
    }

    // 3. Extract Author Bio
    const bioRegex = /About the Author\s*\n([\s\S]+)$/i;
    const bioMatch = text.match(bioRegex);
    if (bioMatch) {
      // Decode any existing urls inside the bio to <a> tags as well so they are clickable
      let bioText = bioMatch[1].trim();
      const urlRegex = /(https?:\/\/[^\s\)<]+)/g;
      bioText = bioText.replace(urlRegex, (url) => {
        let cleanUrl = url;
        let punctuation = '';
        if (cleanUrl.endsWith('.') || cleanUrl.endsWith(',') || cleanUrl.endsWith(']')) {
          punctuation = cleanUrl.slice(-1);
          cleanUrl = cleanUrl.slice(0, -1);
        }
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #007aff; text-decoration: underline;">${cleanUrl}</a>${punctuation}`;
      });

      if (article.author_bio !== bioText) {
        article.author_bio = bioText;
        stats.authorBioExtracted++;
        modified = true;
      }
      // Remove from main description
      text = text.replace(bioRegex, '').replace(/About the Author\s*/i, '').trim();
    }

    // 4. Convert remaining plaintext URLs to <a> tags in description
    const urlRegex = /(https?:\/\/[^\s\)<]+)/g;
    const beforeLinkCount = (text.match(urlRegex) || []).length;
    
    let convertedText = text.replace(urlRegex, (url) => {
      let cleanUrl = url;
      let punctuation = '';
      if (cleanUrl.endsWith('.') || cleanUrl.endsWith(',') || cleanUrl.endsWith(']')) {
        punctuation = cleanUrl.slice(-1);
        cleanUrl = cleanUrl.slice(0, -1);
      }
      // If it's already an a tag (from a previous run or manual edit), don't wrap it again
      // We know it's not because decodeHtml() stripped all tags!
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #007aff; text-decoration: underline;">${cleanUrl}</a>${punctuation}`;
    });

    if (convertedText !== text) {
      text = convertedText;
      stats.linksHyperlinked += beforeLinkCount;
      modified = true;
    }

    // Remove excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (text !== article.description) {
      article.description = text;
      stats.descriptionCleaned++;
      modified = true;
    }

    if (modified) {
      await article.save();
      updatedCount++;
    }
  }

  console.log(`\nUpdated ${updatedCount} articles.`);
  console.log('Stats:', stats);
  process.exit(0);
}

run().catch(console.error);
