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

// ================= API ROUTES (before static) =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Mount admin routes (class CRUD, pending registrations, approval, public class list)
app.use(adminRoutes);

// ================= PAGE ROUTES (before static) =================

// Landing page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'landing.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

// Class tracker pages
app.get('/class/:slug', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ================= STATIC FILES (after all routes) =================
// On Vercel, public/ files are served at edge; locally, serve from project root
app.use(express.static(ROOT));
app.use(express.static(path.join(ROOT, 'public')));

// ================= FALLBACK =================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ================= START =================
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
