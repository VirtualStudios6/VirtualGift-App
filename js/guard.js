(function () {
  'use strict';

  function _go(url) {
    window.location.href = typeof withAppFlag === 'function' ? withAppFlag(url) : url;
  }

  function _isPasswordProvider(user) {
    return user.providerData?.[0]?.providerId === 'password';
  }

  function _runWhenReady(callback) {
    if (typeof window.waitForFirebase === 'function') {
      window.waitForFirebase(callback);
    } else {
      var t = setInterval(function () {
        if (typeof window.waitForFirebase === 'function') {
          clearInterval(t);
          window.waitForFirebase(callback);
        }
      }, 50);
    }
  }

  // Verifica auth + emailVerified. Redirige si falla.
  function requireAuth(options) {
    options = options || {};
    return new Promise(function (resolve) {
      _runWhenReady(function () {
        var auth = window.auth || firebase.auth();
        var unsub = auth.onAuthStateChanged(function (user) {
          unsub();
          if (!user) { _go('index.html'); resolve(null); return; }
          if (!user.emailVerified && _isPasswordProvider(user)) {
            _go('verify-pending.html'); resolve(null); return;
          }
          if (typeof options.onReady === 'function') options.onReady(user);
          resolve(user);
        });
      });
    });
  }

  // Verifica auth + emailVerified. Si no verificado, resuelve null SIN redirigir.
  function requireAuthSoft(options) {
    options = options || {};
    return new Promise(function (resolve) {
      _runWhenReady(function () {
        var auth = window.auth || firebase.auth();
        var unsub = auth.onAuthStateChanged(function (user) {
          unsub();
          if (!user) { _go('index.html'); resolve(null); return; }
          if (!user.emailVerified && _isPasswordProvider(user)) {
            resolve(null); return;
          }
          if (typeof options.onReady === 'function') options.onReady(user);
          resolve(user);
        });
      });
    });
  }

  window.AuthGuard = { requireAuth: requireAuth, requireAuthSoft: requireAuthSoft };
})();
