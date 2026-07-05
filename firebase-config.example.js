// Firebase configuration — Copy this file to firebase-config.js and fill in your values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Set this to the email you registered in Firebase Auth
const ADMIN_EMAIL = "your-email@gmail.com";

firebase.initializeApp(firebaseConfig);
