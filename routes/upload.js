const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    // Generate a unique filename: timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// POST /api/upload - Upload a new image
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    // Return the relative URL so it works everywhere
    const url = `/api/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: url,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.apk' && file.mimetype !== 'application/vnd.android.package-archive') {
      return cb(new Error('Only APK files are allowed!'), false);
    }
    cb(null, true);
  }
});

// POST /api/upload/apk - Upload a new APK
router.post('/upload/apk', uploadApk.single('apk'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No APK file provided' });
    }
    const url = `/api/uploads/apks/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: url,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Upload APK error:', error);
    res.status(500).json({ message: 'Failed to upload APK' });
  }
});

// GET /api/images - List all uploaded images
router.get('/images', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadDir)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const images = [];

    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      // Filter out non-image files
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        
        images.push({
          name: file,
          url: `/api/uploads/${file}`,
          size: stats.size,
          createdAt: stats.mtime
        });
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

