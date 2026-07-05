// Admin API routes — class creation, pending registrations, approval
const express = require("express");
const router = express.Router();
const { getDb, getAuth } = require("./firebase-admin");

const ADMIN_EMAIL = "brailekenteusebio@gmail.com";

// Slugify: "Grade 7 - Section A" → "grade7a"
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "")
    .slice(0, 20);
}

// Verify superadmin via Firebase ID token
async function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split("Bearer ")[1];
  const auth = getAuth();

  if (!auth) {
    return res.status(500).json({ error: "Firebase Admin SDK not configured" });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Not authorized — admin only" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ================= PUBLIC CLASS LIST =================

// GET /api/classes/public — list active classes (no auth required)
router.get("/api/classes/public", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const snapshot = await db.collection("_classes").get();
    const classes = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.auditorEmail) {
        classes.push({ name: data.name, slug: data.slug });
      }
    });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= CLASS ROUTES =================

// GET /api/classes — list all classes (admin only)
router.get("/api/classes", verifyAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const snapshot = await db.collection("_classes").get();
    const classes = [];
    snapshot.forEach((doc) => {
      classes.push({ id: doc.id, ...doc.data() });
    });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/classes — create a new class (admin only)
router.post("/api/classes", verifyAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Class name is required" });
  }

  const slug = slugify(name.trim());
  if (!slug) {
    return res.status(400).json({ error: "Invalid class name" });
  }

  try {
    // Check if slug already exists
    const existing = await db.collection("_classes").doc(slug).get();
    if (existing.exists) {
      return res.status(409).json({ error: "Class with this slug already exists" });
    }

    // Create class metadata
    await db.collection("_classes").doc(slug).set({
      name: name.trim(),
      slug: slug,
      createdAt: new Date().toISOString(),
      createdBy: req.user.email,
    });

    // Create empty app data document
    await db.collection("classFund").doc(slug).set({
      students: [],
      expenses: [],
      archives: [],
      paymentHistory: [],
      skippedWeeks: [],
      startDate: null,
      manualWeekOverride: null,
      currentMonth: null,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      slug,
      name: name.trim(),
      url: `/class/${slug}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/classes/:slug — delete a class (admin only)
router.delete("/api/classes/:slug", verifyAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  const { slug } = req.params;

  try {
    await db.collection("_classes").doc(slug).delete();
    await db.collection("classFund").doc(slug).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PUBLIC REGISTRATION =================

// POST /api/:slug/register — auditor self-registration (no auth required)
router.post("/api/:slug/register", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK not configured" });

  const { slug } = req.params;
  const { name, email, password, message } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    // Check class exists
    const classDoc = await db.collection("_classes").doc(slug).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();

    // Check if class already has an auditor
    if (classData.auditorEmail) {
      return res.status(409).json({ error: "This class already has an auditor" });
    }

    // Check if already pending
    const pendingDoc = await db.collection("_pending").doc(slug).get();
    if (pendingDoc.exists) {
      return res.status(409).json({ error: "Registration already pending approval" });
    }

    // Store pending registration
    await db.collection("_pending").doc(slug).set({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      message: message ? message.trim() : "",
      className: classData.name,
      requestedAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: "Registration submitted. Waiting for admin approval.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/:slug/pending — check if registration is pending (public)
router.get("/api/:slug/pending", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  const { slug } = req.params;

  try {
    const pendingDoc = await db.collection("_pending").doc(slug).get();
    res.json({ pending: pendingDoc.exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PENDING REGISTRATIONS (ADMIN) =================

// GET /api/pending — list all pending registrations (admin only)
router.get("/api/pending", verifyAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const snapshot = await db.collection("_pending").get();
    const pending = [];
    snapshot.forEach((doc) => {
      pending.push({ id: doc.id, ...doc.data() });
    });
    res.json({ pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pending/:slug/approve — approve registration (admin only)
router.post("/api/pending/:slug/approve", verifyAdmin, async (req, res) => {
  const db = getDb();
  const auth = getAuth();
  if (!db || !auth) return res.status(500).json({ error: "Firebase Admin SDK not configured" });

  const { slug } = req.params;

  try {
    const pendingDoc = await db.collection("_pending").doc(slug).get();
    if (!pendingDoc.exists) {
      return res.status(404).json({ error: "Pending registration not found" });
    }

    const data = pendingDoc.data();

    // Create Firebase Auth account
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.name,
      });
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        // User already exists — that's fine, just link them
        userRecord = await auth.getUserByEmail(data.email);
      } else {
        throw err;
      }
    }

    // Update _classes with auditor info (preserve original createdBy/createdAt)
    await db.collection("_classes").doc(slug).update({
      auditorEmail: data.email,
      auditorName: data.name,
      approvedAt: new Date().toISOString(),
      approvedBy: req.user.email,
    });

    // Delete pending doc
    await db.collection("_pending").doc(slug).delete();

    res.json({
      success: true,
      slug,
      auditorEmail: data.email,
      uid: userRecord.uid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pending/:slug/reject — reject registration (admin only)
router.post("/api/pending/:slug/reject", verifyAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not available" });

  const { slug } = req.params;

  try {
    await db.collection("_pending").doc(slug).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
