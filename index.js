// DB Updated with Hello1234 - Restarting server
globalThis.crypto = require('crypto').webcrypto;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger middleware for tracing performance/duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use('/uploads', express.static('/app/uploads', { maxAge: '30d' }));
app.use('/api/uploads', express.static('/app/uploads', { maxAge: '30d' }));

// MongoDB Connection
const seedPages = require('./scripts/seedPages');
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    seedPages();
  })
  .catch(err => console.log('MongoDB Connection Error:', err));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/media-assets', require('./routes/mediaAssets'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/cms-users', require('./routes/adminCmsUsers'));
app.use('/api', require('./routes/upload'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/logs', require('./routes/logs'));


app.get('/', (req, res) => {
  res.send('ITV CMS API is running...');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
