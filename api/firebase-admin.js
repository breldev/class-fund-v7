// Firebase Admin SDK initialization
// Reads credentials from FIREBASE_SERVICE_ACCOUNT env var (JSON string) or ./firebase-service-account.json
const admin = require("firebase-admin");

let initialized = false;

function initAdmin() {
  if (initialized) return admin;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount) {
    // Parse JSON string from env var
    try {
      const creds = typeof serviceAccount === "string" ? JSON.parse(serviceAccount) : serviceAccount;
      admin.initializeApp({ credential: admin.credential.cert(creds) });
      initialized = true;
      console.log("Firebase Admin: initialized from env var");
      return admin;
    } catch (err) {
      console.error("Firebase Admin: failed to parse FIREBASE_SERVICE_ACCOUNT env var:", err.message);
    }
  }

  // Fallback: try local file
  try {
    const creds = require("../firebase-service-account.json");
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    initialized = true;
    console.log("Firebase Admin: initialized from firebase-service-account.json");
    return admin;
  } catch (err) {
    console.warn("Firebase Admin: no credentials found. Server-side features disabled.");
    console.warn("  Set FIREBASE_SERVICE_ACCOUNT env var or place firebase-service-account.json in project root.");
    return null;
  }
}

function getDb() {
  const app = initAdmin();
  return app ? app.firestore() : null;
}

function getAuth() {
  const app = initAdmin();
  return app ? app.auth() : null;
}

module.exports = { initAdmin, getDb, getAuth, admin };
