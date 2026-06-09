/* =================================================
   CHAT.JS — Soporte en tiempo real (usuario)
   ================================================= */
'use strict';

let _chatUid    = null;
let _chatName   = '';
let _chatEmail  = '';
let _chatStatus = 'open';
let _unsubMsgs  = null;
let _unsubDoc   = null;
let _chatInited = false;

// ── NAVIGATION ─────────────────────────────────────
window.chatGoBack = function () {
  if (history.length > 1) history.back();
  else location.href = typeof withAppFlag === 'function'
    ? withAppFlag('soporte.html') : 'soporte.html';
};

// ── SEND TEXT MESSAGE ──────────────────────────────
window.chatSendMessage = function () {
  const input = document.getElementById('chatInput');
  const text  = (input?.value || '').trim();
  if (!text || !_chatUid || _chatStatus === 'closed') return;

  input.value = '';
  input.style.height = 'auto';

  const sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  const FS  = firebase.firestore.FieldValue;
  const now = FS.serverTimestamp();
  const batch = window.db.batch();

  const msgRef = window.db
    .collection('supportChats').doc(_chatUid)
    .collection('messages').doc();
  batch.set(msgRef, {
    from: 'user', text, type: 'text',
    senderName: _chatName, createdAt: now,
  });
  batch.set(window.db.collection('supportChats').doc(_chatUid), {
    userId: _chatUid, userName: _chatName, userEmail: _chatEmail,
    lastMessage: text.slice(0, 100), lastMessageAt: now,
    unreadAdmin: FS.increment(1), status: 'open', createdAt: now,
  }, { merge: true });

  batch.commit().catch(function (e) {
    console.error('[chat] sendMessage:', e);
    if (input) input.value = text;
    chatShowErr('No se pudo enviar. Intenta de nuevo.');
  }).finally(function () {
    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.disabled = false;
    input?.focus();
  });
};

// ── PICK IMAGE ─────────────────────────────────────
window.chatPickImage = function (fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  fileInput.value = '';
  if (_chatStatus === 'closed') { chatShowErr('El chat está cerrado.'); return; }
  if (!file.type.startsWith('image/')) { chatShowErr('Solo se pueden enviar imágenes.'); return; }
  if (file.size > 8 * 1024 * 1024) { chatShowErr('Imagen muy grande (máx. 8 MB).'); return; }
  chatUploadImage(file);
};

function chatUploadImage(file) {
  if (!_chatUid) return;

  const container = document.getElementById('chatMsgs');
  const tmpId     = 'upload-tmp-' + Date.now();
  if (container) {
    container.insertAdjacentHTML('beforeend',
      '<div id="' + tmpId + '" class="msg-row msg-row--user">' +
        '<div class="msg-uploading">' +
          '<div class="upload-spinner"></div>' +
          '<span>Subiendo imagen…</span>' +
        '</div>' +
      '</div>'
    );
    container.scrollTop = container.scrollHeight;
  }

  const sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = 'supportChats/' + _chatUid + '/' + Date.now() + '.' + ext;
  const ref  = firebase.storage().ref(path);

  ref.put(file).then(function (snap) {
    return snap.ref.getDownloadURL();
  }).then(function (imageUrl) {
    const FS  = firebase.firestore.FieldValue;
    const now = FS.serverTimestamp();
    const batch = window.db.batch();
    const msgRef = window.db
      .collection('supportChats').doc(_chatUid)
      .collection('messages').doc();
    batch.set(msgRef, {
      from: 'user', type: 'image', imageUrl: imageUrl, text: '',
      senderName: _chatName, createdAt: now,
    });
    batch.set(window.db.collection('supportChats').doc(_chatUid), {
      userId: _chatUid, userName: _chatName, userEmail: _chatEmail,
      lastMessage: '📷 Imagen', lastMessageAt: now,
      unreadAdmin: FS.increment(1), status: 'open', createdAt: now,
    }, { merge: true });
    return batch.commit();
  }).catch(function (e) {
    console.error('[chat] uploadImage:', e);
    chatShowErr('Error al subir imagen. Intenta de nuevo.');
  }).finally(function () {
    document.getElementById(tmpId)?.remove();
    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.disabled = false;
  });
}

// ── HELPERS ────────────────────────────────────────
function chatShowErr(msg) {
  let el = document.getElementById('chatErrToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chatErrToast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'
      + 'background:rgba(239,68,68,.92);color:#fff;padding:8px 18px;border-radius:20px;'
      + 'font-size:.8rem;font-weight:700;z-index:9999;pointer-events:none;white-space:nowrap;'
      + 'box-shadow:0 4px 16px rgba(0,0,0,.4)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.style.display = 'none'; }, 3000);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
}

function buildMsgHTML(data) {
  const isUser = data.from === 'user';
  const time   = fmtTime(data.createdAt);

  if (data.type === 'image' && data.imageUrl) {
    const safeUrl = esc(data.imageUrl);
    const caption = data.text ? '<div class="msg-img-caption">' + esc(data.text) + '</div>' : '';
    if (isUser) {
      return '<div class="msg-row msg-row--user">'
        + '<div class="msg-bubble bubble--user bubble--img">'
        + '<img src="' + safeUrl + '" class="msg-image" alt="Imagen" onclick="window.open(\'' + safeUrl + '\',\'_blank\')" loading="lazy">'
        + caption
        + '<div class="msg-time">' + time + '</div>'
        + '</div></div>';
    }
    return '<div class="msg-row msg-row--admin">'
      + '<div class="msg-avatar">'
      + '<img src="images/logo-virtual-login.png" alt="Soporte" onerror="this.style.display=\'none\'">'
      + '</div>'
      + '<div class="msg-bubble bubble--admin bubble--img">'
      + '<div class="msg-sender">Soporte VirtualGift</div>'
      + '<img src="' + safeUrl + '" class="msg-image" alt="Imagen" onclick="window.open(\'' + safeUrl + '\',\'_blank\')" loading="lazy">'
      + caption
      + '<div class="msg-time">' + time + '</div>'
      + '</div></div>';
  }

  const text = esc(data.text || '').replace(/\n/g, '<br>');
  if (isUser) {
    return '<div class="msg-row msg-row--user">'
      + '<div class="msg-bubble bubble--user">'
      + '<div class="msg-text">' + text + '</div>'
      + '<div class="msg-time">' + time + '</div>'
      + '</div></div>';
  }
  return '<div class="msg-row msg-row--admin">'
    + '<div class="msg-avatar">'
    + '<img src="images/logo-virtual-login.png" alt="Soporte" onerror="this.style.display=\'none\'">'
    + '</div>'
    + '<div class="msg-bubble bubble--admin">'
    + '<div class="msg-sender">Soporte VirtualGift</div>'
    + '<div class="msg-text">' + text + '</div>'
    + '<div class="msg-time">' + time + '</div>'
    + '</div></div>';
}

// ── SUBSCRIPTIONS ──────────────────────────────────
function subscribeMessages() {
  if (_unsubMsgs) _unsubMsgs();
  const container = document.getElementById('chatMsgs');
  if (!container) return;

  _unsubMsgs = window.db
    .collection('supportChats').doc(_chatUid)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(function (snap) {
      if (!container) return;

      if (snap.empty) {
        container.innerHTML = '<div class="chat-empty">'
          + '<div class="chat-empty-emoji">👋</div>'
          + '<div class="chat-empty-title">¡Hola! ¿En qué te ayudamos?</div>'
          + '<div class="chat-empty-sub">Escríbenos tu consulta y te<br>responderemos lo antes posible.</div>'
          + '</div>';
        return;
      }

      container.innerHTML = snap.docs.map(function (d) { return buildMsgHTML(d.data()); }).join('');
      container.scrollTop = container.scrollHeight;

      window.db.collection('supportChats').doc(_chatUid)
        .update({ unreadUser: 0 }).catch(function () {});
    }, function (err) {
      console.error('[chat] messages snapshot error:', err);
      if (container) container.innerHTML = '<div class="chat-empty">'
        + '<div class="chat-empty-emoji">⚠️</div>'
        + '<div class="chat-empty-title">Error al cargar</div>'
        + '<div class="chat-empty-sub">Código: ' + (err.code || err.message || 'desconocido') + '<br>'
        + '<button onclick="location.reload()" style="color:#8b5cf6;background:none;border:none;cursor:pointer;font-size:inherit;text-decoration:underline;margin-top:8px">Recargar</button>'
        + '</div></div>';
    });
}

function subscribeChatDoc() {
  if (_unsubDoc) _unsubDoc();

  _unsubDoc = window.db.collection('supportChats').doc(_chatUid)
    .onSnapshot(function (doc) {
      if (!doc.exists) return;
      _chatStatus = doc.data().status || 'open';

      const inputBar = document.getElementById('chatInputBar');
      const statusEl = document.getElementById('chatStatusLine');
      const sendBtn  = document.getElementById('chatSendBtn');
      const input    = document.getElementById('chatInput');
      const imgLabel = document.querySelector('.chat-img-label');

      if (_chatStatus === 'closed') {
        if (!document.getElementById('chatClosedBanner')) {
          const banner = document.createElement('div');
          banner.id = 'chatClosedBanner';
          banner.className = 'chat-closed-banner';
          banner.textContent = '🔒 Esta conversación fue cerrada por el equipo de soporte.';
          inputBar?.insertAdjacentElement('beforebegin', banner);
        }
        if (input)  { input.disabled = true; input.placeholder = 'Chat cerrado'; }
        if (sendBtn) sendBtn.disabled = true;
        if (imgLabel) imgLabel.style.pointerEvents = 'none';
        if (statusEl) {
          statusEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0"></span>&nbsp;Chat cerrado';
          statusEl.style.color = '#ef4444';
        }
      } else {
        document.getElementById('chatClosedBanner')?.remove();
        if (input)  { input.disabled = false; input.placeholder = 'Escribe un mensaje...'; }
        if (sendBtn) sendBtn.disabled = false;
        if (imgLabel) imgLabel.style.pointerEvents = '';
        if (statusEl) {
          statusEl.innerHTML = '<span class="status-dot"></span>En línea';
          statusEl.style.color = '#4ade80';
        }
      }
    }, function () {});
}

// ── INIT ────────────────────────────────────────────
function initChat(user) {
  _chatUid   = user.uid;
  _chatEmail = user.email || '';
  _chatName  = (user.displayName || (user.email ? user.email.split('@')[0] : '') || 'Usuario');

  // Wire up buttons immediately (don't wait for profile fetch)
  const sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn) sendBtn.addEventListener('click', window.chatSendMessage);

  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.chatSendMessage();
      }
    });
  }

  // Start listening immediately
  subscribeMessages();
  subscribeChatDoc();

  // Fetch display name in background (non-blocking)
  window.db.collection('users').doc(_chatUid).get()
    .then(function (doc) {
      if (doc.exists) {
        _chatName = doc.data().username || doc.data().displayName || _chatName;
      }
    })
    .catch(function () {});
}

// ── STARTUP ─────────────────────────────────────────
// Show error in messages container if stuck for 12 seconds
var _chatLoadGuard = setTimeout(function () {
  if (_chatInited) return;
  const container = document.getElementById('chatMsgs');
  if (container && container.querySelector('.chat-loading')) {
    container.innerHTML = '<div class="chat-empty">'
      + '<div class="chat-empty-emoji">⚠️</div>'
      + '<div class="chat-empty-title">Sin conexión</div>'
      + '<div class="chat-empty-sub">No se pudo conectar con el servidor.<br>'
      + '<button onclick="location.reload()" style="color:#8b5cf6;background:none;border:none;cursor:pointer;font-size:inherit;text-decoration:underline;margin-top:8px">Recargar</button>'
      + '</div></div>';
  }
}, 12000);

function startChat() {
  if (_chatInited) return;
  if (!window.db || typeof firebase === 'undefined' || typeof firebase.auth !== 'function') return;
  _chatInited = true;
  clearTimeout(_chatLoadGuard);

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      location.href = typeof withAppFlag === 'function'
        ? withAppFlag('login.html') : 'login.html';
      return;
    }
    initChat(user);
  });
}

// Multiple entry points to handle any timing scenario
var _pollCount = 0;
var _pollTimer = setInterval(function () {
  _pollCount++;
  if (window.db && typeof firebase !== 'undefined') {
    clearInterval(_pollTimer);
    startChat();
  } else if (_pollCount >= 120) {
    clearInterval(_pollTimer);
  }
}, 100);

document.addEventListener('DOMContentLoaded', startChat);
window.addEventListener('load', startChat);
