require('dotenv').config();
const express = require('express');
const path = require('path');
const adminRoutes = require('./admin-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve the project root (parent of api/)
const ROOT = path.join(__dirname, '..');

// ================= MIDDLEWARE =================
app.use(express.json());

// ================= LANDING PAGE =================

// Serve landing.html at root (before static middleware so it takes priority over index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'landing.html'));
});

// Serve static files from project root
app.use(express.static(ROOT));

// ================= API ROUTES =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Mount admin routes (class CRUD, pending registrations, approval)
app.use(adminRoutes);

// ================= CLASS ROUTING =================

// Serve index.html for /class/:slug routes
// The client-side code reads the slug from the URL
app.get('/class/:slug', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ================= FALLBACK =================

// Serve admin.html for /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

// Serve index.html for unknown routes (SPA fallback)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ================= START =================

// Only start server when run directly (not imported by Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Class Fund Server running on http://localhost:${PORT}`);
    console.log(`  Local:    http://localhost:${PORT}/`);
    console.log(`  Class:    http://localhost:${PORT}/class/grade7a`);
    console.log(`  Admin:    http://localhost:${PORT}/admin`);
    console.log(`  Health:   http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
