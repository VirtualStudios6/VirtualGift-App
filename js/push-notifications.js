/* ============================================================ */
/* PUSH NOTIFICATIONS — FCM (web) + Capacitor (Android / iOS)   */
/* ============================================================ */

const PUSH_VAPID_KEY = 'BPSwSCdtngHE0Alw7p40M8dAoxRlilVQQFzDB44qkivT3SS9ZAWEfLo0h4K31rH5HVJ6fFtWBSEVDEDRx3Of7BQ';

function _isNative() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

function _getCapPush() {
  return window.Capacitor?.Plugins?.PushNotifications || null;
}

// ── Punto de entrada: llamar al cargar la página con el uid del usuario ────────

async function initPush(uid) {
  if (!uid) return;
  if (_isNative()) {
    await _initNativePush(uid);
  } else {
    await _initWebPush(uid);
  }
}

// ── Punto de entrada: el usuario pulsa el botón "Activar notificaciones" ───────

async function togglePushNotifications(uid) {
  if (!uid) return;
  if (_isNative()) {
    await _requestNativePush(uid);
  } else {
    await _requestWebPush(uid);
  }
}

// ── NATIVE — Android & iOS ────────────────────────────────────────────────────

async function _initNativePush(uid) {
  const Push = _getCapPush();
  if (!Push) return;

  const { receive } = await Push.checkPermissions();
  if (receive === 'granted') {
    _setupNativeListeners(uid);
    await Push.register();
    _updatePushBtn('active');
  } else if (receive === 'denied') {
    _updatePushBtn('blocked');
  } else {
    _updatePushBtn('idle');
  }
}

async function _requestNativePush(uid) {
  const Push = _getCapPush();
  if (!Push) return;

  const btn = document.getElementById('btnPush');
  if (btn) { btn.disabled = true; btn.textContent = '...Activando'; }

  try {
    const { receive } = await Push.requestPermissions();
    if (receive !== 'granted') {
      _updatePushBtn(receive === 'denied' ? 'blocked' : 'idle');
      return;
    }
    _setupNativeListeners(uid);
    await Push.register();
  } catch (e) {
    console.warn('[push] native request:', e.message);
    _updatePushBtn('idle');
  }
}

function _setupNativeListeners(uid) {
  const Push = _getCapPush();
  if (!Push) return;

  Push.addListener('registration', async (token) => {
    await _saveToken(uid, token.value);
    _updatePushBtn('active');
    _showToast('🔔 Notificaciones activadas');
  });

  Push.addListener('registrationError', (err) => {
    console.warn('[push] registrationError:', err.error);
    _updatePushBtn('idle');
  });

  Push.addListener('pushNotificationReceived', (notification) => {
    const title = notification.title || 'VirtualGift';
    const body  = notification.body  || '';
    _showToast(`🔔 ${title}${body ? ': ' + body : ''}`);
  });
}

// ── WEB — Browser / PWA ───────────────────────────────────────────────────────

async function _initWebPush(uid) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'denied') {
    _updatePushBtn('blocked');
    return;
  }
  if (Notification.permission === 'granted') {
    await _getAndSaveWebToken(uid);
    _updatePushBtn('active');
  } else {
    _updatePushBtn('idle');
  }
}

async function _requestWebPush(uid) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    _showToast('Para desactivar, ve a Configuración del navegador → Notificaciones');
    return;
  }

  const btn = document.getElementById('btnPush');
  if (btn) { btn.disabled = true; btn.textContent = '...Activando'; }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      _updatePushBtn(permission === 'denied' ? 'blocked' : 'idle');
      return;
    }
    const ok = await _getAndSaveWebToken(uid);
    _updatePushBtn(ok ? 'active' : 'idle');
    if (ok) _showToast('🔔 Notificaciones activadas');
  } catch (e) {
    console.warn('[push] web request:', e.message);
    _updatePushBtn('idle');
  }
}

async function _getAndSaveWebToken(uid) {
  try {
    if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') return false;
    if (!('serviceWorker' in navigator)) return false;

    const swReg       = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging   = firebase.messaging();
    const tokenOptions = { serviceWorkerRegistration: swReg };
    if (PUSH_VAPID_KEY) tokenOptions.vapidKey = PUSH_VAPID_KEY;

    const token = await messaging.getToken(tokenOptions);
    if (!token) return false;

    await _saveToken(uid, token);

    messaging.onMessage((payload) => {
      const title = payload.notification?.title || 'VirtualGift';
      const body  = payload.notification?.body  || '';
      _showToast(`🔔 ${title}${body ? ': ' + body : ''}`);
    });

    return true;
  } catch (e) {
    console.warn('[push] web token:', e.message);
    return false;
  }
}

// ── SHARED ────────────────────────────────────────────────────────────────────

async function _saveToken(uid, token) {
  if (!token || !window.db) return;
  await window.db.collection('users').doc(uid).set({
    fcmToken:        token,
    fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

function _updatePushBtn(state) {
  const btn = document.getElementById('btnPush');
  if (!btn) return;
  btn.disabled = false;

  if (state === 'active') {
    btn.textContent   = '🔔 Notificaciones activas';
    btn.style.cssText = 'background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#22c55e;';
  } else if (state === 'blocked') {
    btn.textContent   = '🔕 Notificaciones bloqueadas';
    btn.style.cssText = 'opacity:.5;cursor:default;';
    btn.disabled      = true;
  } else {
    btn.textContent   = '🔔 Activar notificaciones push';
    btn.style.cssText = '';
  }
}

function _showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
  clearTimeout(window.__pushToastT);
  window.__pushToastT = setTimeout(() => el.style.display = 'none', 3000);
}
