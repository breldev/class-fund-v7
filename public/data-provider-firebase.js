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

  window.firebaseData = {
    syncAllFromFirestore: syncAllFromFirestore,
    syncAllToFirestore: syncAllToFirestore,
    listenToChanges: listenToChanges,
    getClassId: function () { return CLASS_ID; }
  };
})();
