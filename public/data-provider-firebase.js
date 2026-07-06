// Firebase Firestore data provider for Class Fund Auditor
// Syncs LocalStorage with Firestore for cloud-backed data
// Each class has its own Firestore document: classFund/{classId}/appData
(function () {
  var db = firebase.firestore();

  // ================= CLASS ID =================
  // Extract classId from URL: /class/:slug → "slug"
  // Falls back to window.CLASS_ID if set by server injection
  function getClassId() {
    if (window.CLASS_ID) return window.CLASS_ID;
    var match = window.location.pathname.match(/^\/class\/([^/]+)/);
    if (match) return match[1];
    return null; // No class context (e.g., landing page, admin)
  }

  var CLASS_ID = getClassId();

  // Expose globally so other scripts can access it
  window.CLASS_ID = CLASS_ID;

  // Get the Firestore document reference for this class
  function getClassDoc() {
    if (!CLASS_ID) {
      console.warn("No class ID — using legacy path classFund/appData");
      return db.collection("classFund").doc("appData");
    }
    return db.collection("classFund").doc(CLASS_ID);
  }

  // ================= DATA OPERATIONS =================

  function getAllDataFromLocal() {
    return {
      students: JSON.parse(localStorage.getItem("students") || "[]"),
      expenses: JSON.parse(localStorage.getItem("expenses") || "[]"),
      archives: JSON.parse(localStorage.getItem("archives") || "[]"),
      paymentHistory: JSON.parse(localStorage.getItem("paymentHistory") || "[]"),
      skippedWeeks: JSON.parse(localStorage.getItem("skippedWeeks") || "[]"),
      startDate: localStorage.getItem("startDate") || null,
      manualWeekOverride: localStorage.getItem("manualWeekOverride") || null,
      currentMonth: localStorage.getItem("currentMonth") || null
    };
  }

  function setAllDataToLocal(data) {
    if (Array.isArray(data.students)) localStorage.setItem("students", JSON.stringify(data.students));
    if (Array.isArray(data.expenses)) localStorage.setItem("expenses", JSON.stringify(data.expenses));
    if (Array.isArray(data.archives)) localStorage.setItem("archives", JSON.stringify(data.archives));
    if (Array.isArray(data.paymentHistory)) localStorage.setItem("paymentHistory", JSON.stringify(data.paymentHistory));
    if (Array.isArray(data.skippedWeeks)) localStorage.setItem("skippedWeeks", JSON.stringify(data.skippedWeeks));
    if (data.startDate) localStorage.setItem("startDate", data.startDate);
    if (data.manualWeekOverride) localStorage.setItem("manualWeekOverride", data.manualWeekOverride);
    if (data.currentMonth) localStorage.setItem("currentMonth", data.currentMonth);
  }

  // Read ALL data from Firestore → write to LocalStorage
  function syncAllFromFirestore() {
    return getClassDoc().get().then(function (doc) {
      if (doc.exists) {
        setAllDataToLocal(doc.data());
        return true;
      }
      return false;
    }).catch(function (err) {
      console.warn("Firestore read failed:", err);
      return false;
    });
  }

  // Read ALL data from LocalStorage → write to Firestore
  function syncAllToFirestore() {
    var data = getAllDataFromLocal();
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return getClassDoc().set(data).then(function () {
      return true;
    }).catch(function (err) {
      console.error("Firestore write failed:", err);
      throw err;
    });
  }

  // Listen for real-time changes from Firestore
  function listenToChanges(callback) {
    return getClassDoc().onSnapshot(function (doc) {
      if (doc.exists) {
        var data = doc.data();
        if (callback) callback(data);
      }
    }, function (err) {
      console.warn("Firestore listener error:", err);
    });
  }

  // ================= CLASS SETTINGS =================
  var classSettings = null;

  function mergeSettings(globalSettings, classOverrides) {
    var overrides = classOverrides || {};
    var defaults = globalSettings || {};
    return {
      weeklyFee: overrides.weeklyFee != null ? overrides.weeklyFee : (defaults.weeklyFee || 5),
      categories: overrides.categories || defaults.categories || ["Supplies", "Printing", "Food", "Transport", "Project", "Event", "Misc"],
      locked: overrides.locked === true,
      forceWeeklyFee: overrides.forceWeeklyFee === true,
      features: Object.assign({}, defaults.features || {}, overrides.features || {}),
    };
  }

  function loadSettings() {
    if (!CLASS_ID) {
      classSettings = { weeklyFee: 5, categories: ["Supplies", "Printing", "Food", "Transport", "Project", "Event", "Misc"], locked: false, forceWeeklyFee: false, features: { pdfExport: false } };
      window.classSettings = classSettings;
      return Promise.resolve(classSettings);
    }

    return Promise.all([db.collection("_config").doc("globalSettings").get(), db.collection("_classes").doc(CLASS_ID).get()])
      .then(function (results) {
        var globalDoc = results[0];
        var classDoc = results[1];
        var globalSettings = globalDoc.exists ? globalDoc.data() : {};
        var classOverrides = classDoc.exists ? classDoc.data().settings || {} : {};
        classSettings = mergeSettings(globalSettings, classOverrides);
        window.classSettings = classSettings;
        return classSettings;
      })
      .catch(function (err) {
        console.warn("Settings load failed:", err);
        classSettings = { weeklyFee: 5, categories: ["Supplies", "Printing", "Food", "Transport", "Project", "Event", "Misc"], locked: false, forceWeeklyFee: false, features: { pdfExport: false } };
        window.classSettings = classSettings;
        return classSettings;
      });
  }

  function getSettings() {
    return classSettings || window.classSettings || null;
  }

  function isFeatureEnabled(featureName) {
    var settings = getSettings();
    return settings && settings.features && settings.features[featureName] === true;
  }

  // Load settings automatically after data sync
  var _origSyncAllFromFirestore = syncAllFromFirestore;
  syncAllFromFirestore = function () {
    return _origSyncAllFromFirestore().then(function (result) {
      if (CLASS_ID) return loadSettings().then(function () { return result; });
      return result;
    });
  };

  window.firebaseData = {
    syncAllFromFirestore: syncAllFromFirestore,
    syncAllToFirestore: syncAllToFirestore,
    listenToChanges: listenToChanges,
    getClassId: function () { return CLASS_ID; },
    getSettings: getSettings,
    isFeatureEnabled: isFeatureEnabled,
  };
})();
