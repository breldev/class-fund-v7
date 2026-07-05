// Firebase Authentication for Class Fund Auditor
(function () {
  let _currentUser = null;
  let _isAdmin = false;
  let _authListeners = [];

  const auth = firebase.auth();

  function notifyListeners() {
    _authListeners.forEach(function (cb) { cb(_currentUser, _isAdmin); });
  }

  function signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signOut() {
    return auth.signOut();
  }

  function getCurrentUser() {
    return _currentUser;
  }

  function isAdmin() {
    return _isAdmin;
  }

  function onAuthChanged(callback) {
    _authListeners.push(callback);
    if (_currentUser !== null) {
      callback(_currentUser, _isAdmin);
    }
    return function () {
      _authListeners = _authListeners.filter(function (cb) { return cb !== callback; });
    };
  }

  auth.onAuthStateChanged(function (user) {
    _currentUser = user;
    if (user && user.email && typeof ADMIN_EMAIL !== "undefined" && ADMIN_EMAIL) {
      _isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    } else {
      _isAdmin = false;
    }
    notifyListeners();
  });

  window.cfAuth = {
    signIn: signIn,
    signOut: signOut,
    getCurrentUser: getCurrentUser,
    isAdmin: isAdmin,
    onAuthChanged: onAuthChanged
  };
})();
