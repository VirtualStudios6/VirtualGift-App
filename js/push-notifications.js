/* ============================================================ */
/* PUSH NOTIFICATIONS — Firebase Cloud Messaging (FCM)          */
/*                                                              */
/* ⚠️  REQUIERE VAPID KEY:                                       */
/*   Firebase Console → Project Settings → Cloud Messaging →    */
/*   Web Push certificates → "Generate key pair"                */
/*   Pega el valor en PUSH_VAPID_KEY abajo.                     */
/* ============================================================ */

const PUSH_VAPID_KEY = ''; // TODO: pega aquí tu Web Push certificate key

async function initPush(uid) {
  if (!uid || !('Notification' in window)) return;

  if (Notification.permission === 'denied') {
    _updatePushBtn('blocked');
    return;
  }

  if (Notification.permission === 'granted') {
    await _getAndSaveToken(uid);
    _updatePushBtn('active');
  } else {
    _updatePushBtn('idle');
  }
}

async function togglePushNotifications(uid) {
  if (!uid) return;

  if (Notification.permission === 'granted') {
    _showToast('Para desactivar, ve a Configuración del navegador → Notificaciones');
    return;
  }

  const btn = document.getElementById('btnPush');
  if (btn) { btn.disabled = true; btn.textContent = '...Activando'; }

  try {
    if (!('Notification' in window)) throw new Error('no-api');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      _updatePushBtn(permission === 'denied' ? 'blocked' : 'idle');
      return;
    }

    const ok = await _getAndSaveToken(uid);
    _updatePushBtn(ok ? 'active' : 'idle');

    if (ok) _showToast('🔔 Notificaciones activadas');

  } catch(e) {
    console.warn('[push] togglePushNotifications:', e.message);
    _updatePushBtn('idle');
  }
}

async function _getAndSaveToken(uid) {
  try {
    if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') return false;
    if (!('serviceWorker' in navigator)) return false;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging    = firebase.messaging();
    const tokenOptions = { serviceWorkerRegistration: swReg };
    if (PUSH_VAPID_KEY) tokenOptions.vapidKey = PUSH_VAPID_KEY;

    const token = await messaging.getToken(tokenOptions);
    if (!token || !window.db) return false;

    await window.db.collection('users').doc(uid).set({
      fcmToken:        token,
      fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Notificaciones en foreground (app abierta)
    messaging.onMessage((payload) => {
      const title = payload.notification?.title || 'VirtualGift';
      const body  = payload.notification?.body  || '';
      _showToast(`🔔 ${title}${body ? ': ' + body : ''}`);
    });

    return true;
  } catch(e) {
    console.warn('[push] _getAndSaveToken:', e.message);
    return false;
  }
}

function _updatePushBtn(state) {
  const btn = document.getElementById('btnPush');
  if (!btn) return;
  btn.disabled = false;

  if (state === 'active') {
    btn.textContent        = '🔔 Notificaciones activas';
    btn.style.cssText      = 'background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#22c55e;';
  } else if (state === 'blocked') {
    btn.textContent        = '🔕 Notificaciones bloqueadas';
    btn.style.cssText      = 'opacity:.5;cursor:default;';
    btn.disabled           = true;
  } else {
    btn.textContent        = '🔔 Activar notificaciones push';
    btn.style.cssText      = '';
  }
}

function _showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = 'block';
  clearTimeout(window.__pushToastT);
  window.__pushToastT = setTimeout(() => el.style.display = 'none', 3000);
}
