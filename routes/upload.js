const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const User = require('../models/User');

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: prefix for community uploads + timestamp + original extension
    const isCommunity = req.headers['x-upload-source'] === 'community' || req.headers['x-source'] === 'community';
    const prefix = isCommunity ? 'community_' : '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    // Accept images and PDF files
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      return cb(null, true);
    }
    cb(new Error('Only image files and PDFs are allowed!'), false);
  }
});

// POST /api/upload - Upload a new image or document (accepts file or image field)
router.post('/upload', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No file provided' });
    }
    const file = req.files[0];
    const relativeUrl = `/api/uploads/${file.filename}`;
    const baseUrl = process.env.BASE_URL || 'https://api.interplanetary.tv';
    const fullUrl = `${baseUrl}${relativeUrl}`;
    res.json({ 
      success: true, 
      url: fullUrl,
      relativeUrl: relativeUrl,
      filename: file.filename 
    });
  });
});

const apkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/apks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadApk = multer({ 
  storage: apkStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// POST /api/upload/apk - Upload a new APK / package file
router.post('/upload/apk', uploadApk.single('apk'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }
    const url = `/api/uploads/apks/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: url,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

// GET /api/images - List all uploaded images (CMS Image Library)
router.get('/images', async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadDir)) {
      return res.json({ images: [] });
    }

    // Collect all filenames referenced in community profiles and verification docs to filter them out
    const communityFilenames = new Set();
    try {
      const users = await User.find({}, 'communityProfile verificationDocs');
      users.forEach(u => {
        if (u.verificationDocs?.idDocumentUrl) {
          const fn = path.basename(u.verificationDocs.idDocumentUrl);
          if (fn) communityFilenames.add(fn);
        }
        if (u.communityProfile) {
          if (u.communityProfile.avatarUrl) {
            const fn = path.basename(u.communityProfile.avatarUrl);
            if (fn) communityFilenames.add(fn);
          }
          if (u.communityProfile.coverUrl) {
            const fn = path.basename(u.communityProfile.coverUrl);
            if (fn) communityFilenames.add(fn);
          }
          if (Array.isArray(u.communityProfile.certificates)) {
            u.communityProfile.certificates.forEach(c => {
              if (c.credentialUrl) {
                const fn = path.basename(c.credentialUrl);
                if (fn) communityFilenames.add(fn);
              }
            });
          }
        }
      });
    } catch (dbErr) {
      console.warn('DB lookup error for community filenames:', dbErr);
    }

    const files = fs.readdirSync(uploadDir);
    const images = [];

    files.forEach(file => {
      // Exclude files uploaded from community platform or associated with community profiles
      if (
        file.startsWith('community_') ||
        file.startsWith('community-') ||
        file.startsWith('comm_') ||
        communityFilenames.has(file)
      ) {
        return;
      }

      const ext = path.extname(file).toLowerCase();
      // Filter out non-image files
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
        const filePath = path.join(uploadDir, file);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const stats = fs.statSync(filePath);
          
          images.push({
            name: file,
            url: `/api/uploads/${file}`,
            size: stats.size,
            createdAt: stats.mtime
          });
        }
      }
    });

    // Sort by newest first
    images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, images });
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({ message: 'Failed to retrieve images' });
  }
});

// DELETE /api/images/:filename - Delete an image safely
router.delete('/images/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Prevent directory traversal attacks!
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      return res.status(404).json({ message: 'Image not found' });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

module.exports = router;

