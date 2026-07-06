// Class-scoped localStorage — auto-prefixes all keys with classId
// Must be loaded AFTER data-provider-firebase.js (which sets window.CLASS_ID)
(function () {
  var classId = window.CLASS_ID;
  if (!classId) return; // No class context → use default localStorage

  var PREFIX = classId + ":";
  var EXCLUDE = ["cfPrefs", "cf-theme", "autoBackupDate"];

  var _get = localStorage.getItem.bind(localStorage);
  var _set = localStorage.setItem.bind(localStorage);
  var _remove = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (key) {
    return _get(EXCLUDE.includes(key) ? key : PREFIX + key);
  };

  localStorage.setItem = function (key, value) {
    _set(EXCLUDE.includes(key) ? key : PREFIX + key, value);
  };

  localStorage.removeItem = function (key) {
    _remove(EXCLUDE.includes(key) ? key : PREFIX + key);
  };

  console.log("ClassStorage: scoped to", classId);
})();
