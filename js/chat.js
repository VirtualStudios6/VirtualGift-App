/* =================================================
   CHAT.JS — Soporte en tiempo real (usuario)
   ================================================= */
'use strict';

// ── State ──────────────────────────────────────────
let _chatUid         = null;
let _chatName        = '';
let _chatEmail       = '';
let _chatStatus      = 'open';
let _prevStatus      = null;
let _unsubMsgs       = null;
let _unsubDoc        = null;
let _chatInited      = false;
let _userTypingTimer = null;
let _surveyRated     = false;
let _inChatView      = false;

// ── NAVIGATION ─────────────────────────────────────
window.chatGoBack = function () {
  if (_inChatView) { window.chatShowHelp(); return; }
  if (history.length > 1) history.back();
  else location.href = typeof withAppFlag === 'function'
    ? withAppFlag('soporte.html') : 'soporte.html';
};

window.chatShowHelp = function () {
  _inChatView = false;
  document.getElementById('helpView').style.display     = '';
  document.getElementById('chatView').style.display     = 'none';
  document.getElementById('chatInputBar').style.display = 'none';
  document.getElementById('hdrHelpBtn').style.display   = 'none';
  const helpCta = document.getElementById('helpCta');
  if (helpCta) helpCta.style.display = '';
  _hideQR();
};

window.chatShowChat = function () {
  _inChatView = true;
  document.getElementById('helpView').style.display     = 'none';
  document.getElementById('chatView').style.display     = '';
  document.getElementById('chatInputBar').style.display = '';
  document.getElementById('hdrHelpBtn').style.display   = '';
  const helpCta = document.getElementById('helpCta');
  if (helpCta) helpCta.style.display = 'none';
  const cc = document.getElementById('chatContent');
  if (cc) setTimeout(function () { cc.scrollTop = cc.scrollHeight; }, 50);
  const input = document.getElementById('chatInput');
  if (input) setTimeout(function () { input.focus(); }, 120);
};

// ── FAQ ACCORDION ──────────────────────────────────
window.chatToggleFaq = function (btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
};

// ── QUICK TOPICS ───────────────────────────────────
const _TOPIC_MSG = {
  canje:  'Hola, tengo un problema con un canje de premios. ¿Pueden ayudarme?',
  pago:   'Hola, tengo una consulta sobre un pago o cobro en mi cuenta.',
  sorteo: 'Hola, tengo una pregunta sobre los sorteos de VirtualGift.',
  cuenta: 'Hola, tengo un problema para acceder a mi cuenta.',
  error:  'Hola, quiero reportar un error técnico en la aplicación.',
  otro:   'Hola, tengo una consulta sobre VirtualGift.',
};

window.chatQuickTopic = function (topic) {
  window.chatShowChat();
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = _TOPIC_MSG[topic] || _TOPIC_MSG.otro;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.focus();
  }
};

// ── QUICK REPLIES ──────────────────────────────────
window.chatToggleQR = function () {
  document.getElementById('qrPanel')?.classList.toggle('visible');
};

function _hideQR() {
  document.getElementById('qrPanel')?.classList.remove('visible');
}

window.chatInsertQR = function (text) {
  _hideQR();
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  input.focus();
};

// ── TYPING ─────────────────────────────────────────
function setUserTyping(typing) {
  if (!_chatUid) return;
  window.db.collection('supportChats').doc(_chatUid)
    .update({ typingUser: typing })
    .catch(function () {});
}

// ── SEND MESSAGE ───────────────────────────────────
window.chatSendMessage = function () {
  const input = document.getElementById('chatInput');
  const text  = (input?.value || '').trim();
  if (!text) return;

  if (!_chatUid) {
    try {
      const cu = window.db && firebase.auth().currentUser;
      if (cu) initChat(cu);
    } catch (e) {}
    if (!_chatUid) { _toast('Conectando… espera un momento'); return; }
  }

  if (_chatStatus === 'closed') { _toast('🔒 El chat está cerrado.', 'error'); return; }

  if (_userTypingTimer) { clearTimeout(_userTypingTimer); _userTypingTimer = null; }
  setUserTyping(false);
  _hideQR();

  input.value = '';
  input.style.height = 'auto';

  if (!_inChatView) window.chatShowChat();

  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = true;

  const FS  = firebase.firestore.FieldValue;
  const now = FS.serverTimestamp();
  const batch = window.db.batch();

  const msgRef = window.db.collection('supportChats').doc(_chatUid).collection('messages').doc();
  batch.set(msgRef, { from:'user', text, type:'text', senderName:_chatName, createdAt:now });

  batch.set(window.db.collection('supportChats').doc(_chatUid), {
    userId:_chatUid, userName:_chatName, userEmail:_chatEmail,
    lastMessage:text.slice(0,100), lastMessageAt:now,
    unreadAdmin:FS.increment(1), status:'waiting', createdAt:now, typingUser:false,
  }, { merge:true });

  batch.commit().catch(function (e) {
    console.error('[chat] sendMessage:', e);
    if (input) input.value = text;
    _toast('No se pudo enviar. Intenta de nuevo.', 'error');
  }).finally(function () {
    const b = document.getElementById('chatSendBtn');
    if (b) b.disabled = false;
    input?.focus();
  });
};

// ── FILE UPLOAD ────────────────────────────────────
window.chatPickFile = function (fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  fileInput.value = '';

  if (_chatStatus === 'closed') { _toast('🔒 El chat está cerrado.', 'error'); return; }
  if (file.size > 16 * 1024 * 1024) { _toast('Archivo muy grande (máx. 16 MB)', 'error'); return; }

  if (!_inChatView) window.chatShowChat();
  _chatUploadFile(file, file.type.startsWith('image/') ? 'image' : 'file');
};

async function _chatUploadFile(file, type) {
  if (!_chatUid) return;

  const cc    = document.getElementById('chatContent');
  const tmpId = 'upload-tmp-' + Date.now();
  if (cc) {
    cc.insertAdjacentHTML('beforeend',
      `<div id="${tmpId}" class="msg-row msg-row--user">
        <div class="msg-uploading">
          <div class="spin-ring-sm"></div>
          <span>Subiendo ${type === 'image' ? 'imagen' : 'archivo'}…</span>
        </div>
      </div>`
    );
    cc.scrollTop = cc.scrollHeight;
  }

  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = true;

  try {
    const ext  = file.name.split('.').pop().toLowerCase() || 'bin';
    const snap = await firebase.storage().ref(`supportChats/${_chatUid}/${Date.now()}.${ext}`).put(file);
    const url  = await snap.ref.getDownloadURL();

    const FS  = firebase.firestore.FieldValue;
    const now = FS.serverTimestamp();
    const batch = window.db.batch();

    const msgData = { from:'user', text:'', senderName:_chatName, createdAt:now };
    if (type === 'image') {
      msgData.type = 'image'; msgData.imageUrl = url;
    } else {
      msgData.type = 'file'; msgData.fileUrl = url; msgData.fileName = file.name; msgData.fileSize = file.size;
    }

    batch.set(window.db.collection('supportChats').doc(_chatUid).collection('messages').doc(), msgData);
    batch.set(window.db.collection('supportChats').doc(_chatUid), {
      userId:_chatUid, userName:_chatName, userEmail:_chatEmail,
      lastMessage: type === 'image' ? '📷 Imagen' : '📎 ' + file.name.slice(0,40),
      lastMessageAt:now, unreadAdmin:FS.increment(1), status:'waiting', createdAt:now,
    }, { merge:true });

    await batch.commit();
  } catch (e) {
    console.error('[chat] uploadFile:', e);
    _toast('Error al subir archivo. Intenta de nuevo.', 'error');
  } finally {
    document.getElementById(tmpId)?.remove();
    const b = document.getElementById('chatSendBtn');
    if (b) b.disabled = false;
  }
}

// ── MESSAGE BUILDER ────────────────────────────────
function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' });
}

function _buildMsg(data) {
  const isUser = data.from === 'user';
  const time   = _fmtTime(data.createdAt);
  const adminAvatar = `<div class="msg-avatar"><img src="images/logo soporte.png" alt="S" onerror="this.style.display='none'"></div>`;

  // Image
  if (data.type === 'image' && data.imageUrl) {
    const safeUrl = _esc(data.imageUrl);
    const cap     = data.text ? `<div class="msg-img-caption">${_esc(data.text)}</div>` : '';
    if (isUser) return `<div class="msg-row msg-row--user">
      <div class="msg-bubble bubble--user bubble--img">
        <img src="${safeUrl}" class="msg-image" alt="Imagen" loading="lazy" onclick="window.open('${safeUrl}','_blank')">
        ${cap}<div class="msg-time">${time}</div>
      </div></div>`;
    return `<div class="msg-row msg-row--admin">${adminAvatar}
      <div class="msg-bubble bubble--admin bubble--img">
        <div class="msg-sender">Soporte VirtualGift</div>
        <img src="${safeUrl}" class="msg-image" alt="Imagen" loading="lazy" onclick="window.open('${safeUrl}','_blank')">
        ${cap}<div class="msg-time">${time}</div>
      </div></div>`;
  }

  // File card
  if (data.type === 'file' && data.fileUrl) {
    const ext  = (data.fileName || '').split('.').pop().toUpperCase() || 'FILE';
    const size = data.fileSize
      ? (data.fileSize < 1048576
          ? (data.fileSize / 1024).toFixed(1) + ' KB'
          : (data.fileSize / 1048576).toFixed(1) + ' MB')
      : '';
    const card = `<div class="msg-file-card" onclick="window.open('${_esc(data.fileUrl)}','_blank')">
      <div class="msg-file-icon">📎</div>
      <div class="msg-file-info">
        <div class="msg-file-name">${_esc(data.fileName || 'Archivo')}</div>
        <div class="msg-file-meta">${ext}${size ? ' · ' + size : ''}</div>
      </div>
      <div class="msg-file-dl">⬇</div>
    </div>`;
    if (isUser) return `<div class="msg-row msg-row--user">
      <div style="max-width:82%">${card}<div style="font-size:.6rem;opacity:.5;text-align:right;margin-top:4px;padding-right:4px">${time}</div></div></div>`;
    return `<div class="msg-row msg-row--admin">${adminAvatar}
      <div style="max-width:82%">
        <div class="msg-sender" style="margin-bottom:4px">Soporte VirtualGift</div>
        ${card}<div style="font-size:.6rem;opacity:.5;margin-top:4px;padding-left:4px">${time}</div>
      </div></div>`;
  }

  // Text
  const body = _esc(data.text || '').replace(/\n/g, '<br>');
  if (isUser) return `<div class="msg-row msg-row--user">
    <div class="msg-bubble bubble--user">
      <div>${body}</div><div class="msg-time">${time}</div>
    </div></div>`;
  return `<div class="msg-row msg-row--admin">${adminAvatar}
    <div class="msg-bubble bubble--admin">
      <div class="msg-sender">Soporte VirtualGift</div>
      <div>${body}</div><div class="msg-time">${time}</div>
    </div></div>`;
}

// ── TICKET BAR HTML ────────────────────────────────
function _ticketBarHTML() {
  const map = {
    open:    { label:'🟢 Abierto',     s:'open'    },
    waiting: { label:'⏳ En revisión', s:'waiting' },
    replied: { label:'🔵 Respondido',  s:'replied' },
    closed:  { label:'⚫ Cerrado',     s:'closed'  },
  };
  const cfg = map[_chatStatus] || map.waiting;
  const num = _chatUid ? '#' + _chatUid.slice(0,8).toUpperCase() : '#—';
  return `<div class="ticket-bar" id="ticketBar">
    <span class="ticket-icon">🎫</span>
    <div class="ticket-info">
      <div class="ticket-title">TICKET</div>
      <div class="ticket-num">${num}</div>
    </div>
    <span class="ticket-badge" data-s="${cfg.s}">${cfg.label}</span>
  </div>`;
}

// ── TYPING ROW ─────────────────────────────────────
function _typingRowHTML() {
  return `<div class="chat-typing-row" id="chatTypingRow">
    <div class="msg-avatar"><img src="images/logo soporte.png" alt="S" onerror="this.style.display='none'"></div>
    <div class="chat-typing-bubble">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div>
  </div>`;
}

// ── SURVEY HTML ────────────────────────────────────
function _surveyHTML() {
  return `<div class="chat-survey" id="chatSurvey">
    <div class="chat-survey-title">¿Tu problema fue resuelto? 🤔</div>
    <div class="chat-survey-sub">Tu opinión nos ayuda a mejorar el soporte de VirtualGift.</div>
    <div class="survey-stars">
      ${[1,2,3,4,5].map(n => `<div class="survey-star" data-r="${n}" onclick="window.chatSelectStar(${n})">⭐</div>`).join('')}
    </div>
    <textarea class="survey-comment" id="surveyComment" rows="2" placeholder="Comentario opcional (máx. 300 chars)…" maxlength="300"></textarea>
    <button class="survey-submit" id="surveySubmit" onclick="window.chatSubmitSurvey()">Enviar calificación</button>
    <div class="survey-done" id="surveyDone">¡Gracias por tu opinión! 🎉</div>
  </div>`;
}

// ── SURVEY LOGIC ───────────────────────────────────
let _surveyRating = 0;

window.chatSelectStar = function (n) {
  _surveyRating = n;
  document.querySelectorAll('.survey-star').forEach(el => {
    el.classList.toggle('sel', parseInt(el.dataset.r) <= n);
  });
};

window.chatSubmitSurvey = async function () {
  if (!_surveyRating) { _toast('Selecciona una calificación', 'error'); return; }
  if (!_chatUid) return;
  const btn     = document.getElementById('surveySubmit');
  const comment = document.getElementById('surveyComment')?.value?.trim() || '';
  if (btn) btn.disabled = true;

  try {
    await window.db.collection('supportChats').doc(_chatUid).update({
      rating:        _surveyRating,
      ratingComment: comment,
      ratedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    });
    _surveyRated = true;
    const done    = document.getElementById('surveyDone');
    const stars   = document.querySelector('.survey-stars');
    const cmt     = document.getElementById('surveyComment');
    if (done)  { done.style.display = 'block'; }
    if (stars)   stars.style.display = 'none';
    if (cmt)     cmt.style.display = 'none';
    if (btn)     btn.style.display = 'none';
    _toast('¡Gracias por tu calificación! 🎉', 'ok');
  } catch (e) {
    console.error('[chat] submitSurvey:', e);
    if (btn) btn.disabled = false;
    _toast('Error al enviar. Intenta de nuevo.', 'error');
  }
};

// ── SUBSCRIBE MESSAGES ─────────────────────────────
function subscribeMessages() {
  if (_unsubMsgs) _unsubMsgs();
  const cc = document.getElementById('chatContent');
  if (!cc) return;

  _unsubMsgs = window.db
    .collection('supportChats').doc(_chatUid)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(function (snap) {
      if (!cc) return;

      const base = _ticketBarHTML();

      if (snap.empty) {
        cc.innerHTML = base
          + `<div class="chat-welcome">
               <div class="chat-welcome-title">¡Bienvenido al soporte! 👋</div>
               <div class="chat-welcome-text">Cuéntanos cómo podemos ayudarte hoy.<br>Nuestro equipo responde en minutos.</div>
             </div>`;
      } else {
        const msgs = snap.docs.map(d => d.data());
        const isClosed = _chatStatus === 'closed';
        cc.innerHTML = base
          + `<div class="chat-divider">Inicio de conversación</div>`
          + `<div class="chat-welcome">
               <div class="chat-welcome-title">Soporte VirtualGift</div>
               <div class="chat-welcome-text">Estamos aquí para ayudarte. Responderemos lo antes posible.</div>
             </div>`
          + msgs.map(_buildMsg).join('')
          + _typingRowHTML()
          + `<div class="chat-closed-banner" id="chatClosedBanner" style="${isClosed ? '' : 'display:none'}">
               🔒 Esta conversación fue cerrada por el equipo de soporte.
             </div>`
          + (isClosed && !_surveyRated ? _surveyHTML() : '');
      }

      cc.scrollTop = cc.scrollHeight;

      window.db.collection('supportChats').doc(_chatUid)
        .update({ unreadUser: 0 }).catch(function () {});
    }, function (err) {
      console.error('[chat] messages snapshot:', err);
      cc.innerHTML = `<div class="chat-empty">
        <div class="chat-empty-emoji">⚠️</div>
        <div class="chat-empty-title">Error al cargar</div>
        <div class="chat-empty-sub">${_esc(err.code || err.message || 'desconocido')}<br>
          <button onclick="location.reload()" style="color:#8b5cf6;background:none;border:none;cursor:pointer;font-size:inherit;text-decoration:underline;margin-top:8px">Recargar</button>
        </div></div>`;
    });
}

// ── SUBSCRIBE CHAT DOC ─────────────────────────────
function subscribeChatDoc() {
  if (_unsubDoc) _unsubDoc();

  _unsubDoc = window.db.collection('supportChats').doc(_chatUid)
    .onSnapshot(function (doc) {
      if (!doc.exists) return;
      const data      = doc.data();
      const newStatus = data.status || 'waiting';

      // State-change toasts (skip first load)
      if (_prevStatus !== null && _prevStatus !== newStatus) {
        if (newStatus === 'replied') {
          _toast('💬 El soporte ha respondido tu consulta');
        } else if (newStatus === 'closed') {
          _toast('✅ Tu ticket ha sido cerrado', 'ok');
        } else if (_prevStatus === 'closed') {
          _toast('🔓 Tu ticket fue reabierto');
        }
      }
      _prevStatus = newStatus;
      _chatStatus = newStatus;

      const isClosed = newStatus === 'closed';

      // Update ticket badge
      const badge = document.querySelector('.ticket-badge');
      if (badge) {
        const map = {
          open:    '🟢 Abierto',
          waiting: '⏳ En revisión',
          replied: '🔵 Respondido',
          closed:  '⚫ Cerrado',
        };
        badge.textContent = map[newStatus] || map.waiting;
        badge.dataset.s = newStatus;
      }

      // Header status line
      const statusEl = document.getElementById('hdrStatusLine');
      if (statusEl) {
        if (isClosed) {
          statusEl.className = 'hdr-status st-closed';
          statusEl.innerHTML = '<span class="hdr-status-dot"></span>Chat cerrado';
        } else if (newStatus === 'replied') {
          statusEl.className = 'hdr-status st-replied';
          statusEl.innerHTML = '<span class="hdr-status-dot"></span>Respondido — escribe para continuar';
        } else {
          statusEl.className = 'hdr-status';
          statusEl.innerHTML = '<span class="hdr-status-dot"></span>Soporte en línea';
        }
      }

      // Closed banner
      const closedBanner = document.getElementById('chatClosedBanner');
      if (closedBanner) closedBanner.style.display = isClosed ? '' : 'none';

      // Input bar state
      const input   = document.getElementById('chatInput');
      const sendBtn = document.getElementById('chatSendBtn');
      const fileBtn = document.querySelector('label[for="chatFileInput"]');
      if (isClosed) {
        if (input)   { input.disabled = true; input.placeholder = 'Chat cerrado'; }
        if (sendBtn)  sendBtn.disabled = true;
        if (fileBtn)  fileBtn.style.pointerEvents = 'none';
      } else {
        if (input)   { input.disabled = false; input.placeholder = 'Escribe un mensaje…'; }
        if (sendBtn)  sendBtn.disabled = false;
        if (fileBtn)  fileBtn.style.pointerEvents = '';
      }

      // Admin typing indicator
      const typingRow = document.getElementById('chatTypingRow');
      if (typingRow) {
        const typing = data.typingAdmin === true;
        typingRow.classList.toggle('visible', typing);
        if (typing) {
          const cc = document.getElementById('chatContent');
          if (cc) cc.scrollTop = cc.scrollHeight;
        }
      }

      // Satisfaction survey: show when closed and not yet rated
      if (data.rating) { _surveyRated = true; }
      const cc = document.getElementById('chatContent');
      if (isClosed && !_surveyRated && cc && !document.getElementById('chatSurvey')) {
        cc.insertAdjacentHTML('beforeend', _surveyHTML());
        cc.scrollTop = cc.scrollHeight;
      }
      if (data.rating) {
        // Hide survey if user already rated (e.g. on re-open)
        const survey = document.getElementById('chatSurvey');
        if (survey) survey.style.display = 'none';
      }
    }, function () {});
}

// ── TOAST ──────────────────────────────────────────
function _toast(msg, type) {
  const el = document.getElementById('chatToast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'chat-toast' + (type === 'error' ? ' t-error' : type === 'ok' ? ' t-ok' : '');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 3500);
}

// ── INIT ───────────────────────────────────────────
function initChat(user) {
  _chatUid   = user.uid;
  _chatEmail = user.email || '';
  _chatName  = user.displayName || (user.email ? user.email.split('@')[0] : '') || 'Usuario';

  const sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn) sendBtn.addEventListener('click', window.chatSendMessage);

  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      if (_chatStatus !== 'closed') {
        setUserTyping(true);
        clearTimeout(_userTypingTimer);
        _userTypingTimer = setTimeout(function () {
          setUserTyping(false); _userTypingTimer = null;
        }, 3000);
      }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.chatSendMessage(); }
    });
  }

  // If user has previous messages, update CTA label — but ALWAYS start on helpView
  window.db.collection('supportChats').doc(_chatUid)
    .collection('messages').limit(1).get()
    .then(function (snap) {
      const ctaBtn = document.getElementById('helpCtaBtn');
      if (!snap.empty && ctaBtn) {
        ctaBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:19px;height:19px;fill:#fff;flex-shrink:0"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>Ver mi conversación`;
      }
    })
    .catch(function () {});

  subscribeMessages();
  subscribeChatDoc();

  // Fetch display name (non-blocking)
  window.db.collection('users').doc(_chatUid).get()
    .then(function (doc) {
      if (doc.exists) _chatName = doc.data().username || doc.data().displayName || _chatName;
    })
    .catch(function () {});
}

// ── STARTUP ────────────────────────────────────────
var _chatLoadGuard = setTimeout(function () {
  if (_chatInited) return;
  const cc = document.getElementById('chatContent');
  if (cc && cc.querySelector('.chat-loading')) {
    cc.innerHTML = `<div class="chat-empty">
      <div class="chat-empty-emoji">⚠️</div>
      <div class="chat-empty-title">Sin conexión</div>
      <div class="chat-empty-sub">No se pudo conectar con el servidor.<br>
        <button onclick="location.reload()" style="color:#8b5cf6;background:none;border:none;cursor:pointer;font-size:inherit;text-decoration:underline;margin-top:8px">Recargar</button>
      </div></div>`;
  }
}, 12000);

function startChat() {
  if (_chatInited) return;
  if (!window.db || typeof firebase === 'undefined' || typeof firebase.auth !== 'function') return;
  _chatInited = true;
  clearTimeout(_chatLoadGuard);

  try {
    const cu = firebase.auth().currentUser;
    if (cu) {
      initChat(cu);
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user && _chatUid) {
          location.href = typeof withAppFlag === 'function'
            ? withAppFlag('login.html') : 'login.html';
        }
      });
      return;
    }
  } catch (e) {
    console.warn('[chat] currentUser check:', e);
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      location.href = typeof withAppFlag === 'function'
        ? withAppFlag('login.html') : 'login.html';
      return;
    }
    if (_chatUid) return;
    initChat(user);
  });
}

var _pollCount = 0;
var _pollTimer = setInterval(function () {
  _pollCount++;
  if (window.db && typeof firebase !== 'undefined') { clearInterval(_pollTimer); startChat(); }
  else if (_pollCount >= 120) clearInterval(_pollTimer);
}, 100);

document.addEventListener('DOMContentLoaded', startChat);
window.addEventListener('load', startChat);
