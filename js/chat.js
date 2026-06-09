/* =================================================
   CHAT.JS — Soporte en tiempo real (usuario)
   ================================================= */
'use strict';

// ── State ──────────────────────────────────────────
let _chatUid          = null;
let _chatName         = '';
let _chatEmail        = '';
let _chatStatus       = 'open';
let _prevStatus       = null;
let _unsubMsgs        = null;
let _unsubDoc         = null;
let _chatInited       = false;
let _userTypingTimer  = null;
let _surveyRated      = false;
let _inChatView       = false;
let _renderedMsgIds   = new Set();
let _lastRenderedDate = null;
let _unreadAdmin      = 0;
let _prevUnreadAdmin  = 0;
let _imagePreviewFile = null;
let _surveyRating     = 0;

// ── NAVIGATION ─────────────────────────────────────
window.chatGoBack = function () {
  if (_inChatView) { window.chatShowHelp(); return; }
  if (history.length > 1) history.back();
  else location.href = typeof withAppFlag === 'function'
    ? withAppFlag('soporte.html') : 'soporte.html';
};

window.chatShowHelp = function () {
  _inChatView = false;
  document.getElementById('helpView').style.display   = '';
  document.getElementById('chatView').style.display   = 'none';
  document.getElementById('hdrHelpBtn').style.display = 'none';
  _showScrollBtn(false);
  _hideQR();
  _updateHeaderStatus();
};

window.chatShowChat = function () {
  _inChatView = true;
  document.getElementById('helpView').style.display   = 'none';
  document.getElementById('chatView').style.display   = '';
  document.getElementById('hdrHelpBtn').style.display = '';
  _hideQR();
  _updateHeaderStatus();
  const cc = document.getElementById('chatContent');
  if (cc) requestAnimationFrame(function () { _scrollToBottom(cc); });
  const input = document.getElementById('chatInput');
  if (input) setTimeout(function () { input.focus(); }, 120);
};

// ── HEADER STATUS (centralizada) ───────────────────
function _updateHeaderStatus() {
  const el = document.getElementById('hdrStatusLine');
  if (!el) return;
  if (!_inChatView) {
    el.className = 'hdr-status';
    el.innerHTML = '<span class="hdr-status-dot"></span>En línea';
    return;
  }
  if (_chatStatus === 'closed') {
    el.className = 'hdr-status st-closed';
    el.innerHTML = '<span class="hdr-status-dot"></span>Chat cerrado';
  } else if (_chatStatus === 'replied') {
    el.className = 'hdr-status st-replied';
    el.innerHTML = '<span class="hdr-status-dot"></span>Respondido — escribe para continuar';
  } else {
    el.className = 'hdr-status';
    el.innerHTML = '<span class="hdr-status-dot"></span>Soporte en línea';
  }
}

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
    .set({ typingUser: typing }, { merge: true })
    .catch(function () {});
}

// ── SCROLL HELPERS ─────────────────────────────────
function _isNearBottom(cc) {
  return cc.scrollHeight - cc.scrollTop - cc.clientHeight < 120;
}

function _scrollToBottom(cc, smooth) {
  if (smooth) cc.scrollTo({ top: cc.scrollHeight, behavior: 'smooth' });
  else        cc.scrollTop = cc.scrollHeight;
}

function _showScrollBtn(show) {
  const btn = document.getElementById('chatScrollBtn');
  if (btn) btn.classList.toggle('visible', !!show);
}

// ── DATE HELPERS ───────────────────────────────────
function _getDateKey(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

function _dateSepHTML(ts) {
  if (!ts) return '';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let label;
  if (msgDay === today)            label = 'Hoy';
  else if (msgDay === yesterday)   label = 'Ayer';
  else label = d.toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' });
  return `<div class="chat-date-sep" role="separator"><span>${label}</span></div>`;
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

  const FS    = firebase.firestore.FieldValue;
  const now   = FS.serverTimestamp();
  const batch = window.db.batch();

  const msgRef = window.db.collection('supportChats').doc(_chatUid).collection('messages').doc();
  batch.set(msgRef, {
    from:'user', text, type:'text', senderName:_chatName,
    createdAt:now, status:'sent',
  });

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

// ── FILE VALIDATION ────────────────────────────────
var _ALLOWED_EXTS = ['jpg','jpeg','png','gif','webp','heic','pdf','doc','docx','zip','txt','xlsx','csv','mp4','mp3'];

function _validateFile(file) {
  if (file.size > 16 * 1024 * 1024) {
    _toast('Archivo muy grande (máx. 16 MB)', 'error'); return false;
  }
  var ext = file.name.split('.').pop().toLowerCase();
  if (!_ALLOWED_EXTS.includes(ext)) {
    _toast('Tipo no permitido. Usa: imágenes, PDF, Word, ZIP o texto', 'error'); return false;
  }
  return true;
}

// ── IMAGE PREVIEW ──────────────────────────────────
window.chatPickFile = function (fileInput) {
  var file = fileInput?.files?.[0];
  if (!file) return;
  fileInput.value = '';

  if (_chatStatus === 'closed') { _toast('🔒 El chat está cerrado.', 'error'); return; }
  if (!_validateFile(file)) return;

  if (file.type.startsWith('image/')) {
    _showImagePreview(file);
  } else {
    if (!_inChatView) window.chatShowChat();
    _chatUploadFile(file, 'file');
  }
};

function _showImagePreview(file) {
  _imagePreviewFile = file;
  var reader = new FileReader();
  reader.onload = function (e) {
    var overlay = document.getElementById('imgPreviewOverlay');
    var img     = document.getElementById('imgPreviewEl');
    var name    = document.getElementById('imgPreviewName');
    if (!overlay || !img) return;
    img.src = e.target.result;
    if (name) {
      var n = file.name;
      name.textContent = n.length > 42 ? n.slice(0, 39) + '…' : n;
    }
    overlay.classList.add('visible');
  };
  reader.readAsDataURL(file);
}

window.chatCancelPreview = function () {
  _imagePreviewFile = null;
  var overlay = document.getElementById('imgPreviewOverlay');
  if (overlay) overlay.classList.remove('visible');
};

window.chatConfirmPreview = function () {
  var file = _imagePreviewFile;
  if (!file) return;
  window.chatCancelPreview();
  if (!_inChatView) window.chatShowChat();
  _chatUploadFile(file, 'image');
};

async function _chatUploadFile(file, type) {
  if (!_chatUid) return;

  const cc    = document.getElementById('chatContent');
  const tmpId = 'upload-tmp-' + Date.now();
  if (cc) {
    const anchor = document.getElementById('chatTypingRow')
                || document.getElementById('chatClosedBanner')
                || document.getElementById('chatSurvey');
    const uploadHtml = `<div id="${tmpId}" class="msg-row msg-row--user">
      <div class="msg-uploading">
        <div class="spin-ring-sm"></div>
        <span>Subiendo ${type === 'image' ? 'imagen' : 'archivo'}…</span>
      </div>
    </div>`;
    if (anchor) anchor.insertAdjacentHTML('beforebegin', uploadHtml);
    else        cc.insertAdjacentHTML('beforeend', uploadHtml);
    _scrollToBottom(cc);
  }

  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = true;

  try {
    const ext  = file.name.split('.').pop().toLowerCase() || 'bin';
    const snap = await firebase.storage().ref(`supportChats/${_chatUid}/${Date.now()}.${ext}`).put(file);
    const url  = await snap.ref.getDownloadURL();

    const FS    = firebase.firestore.FieldValue;
    const now   = FS.serverTimestamp();
    const batch = window.db.batch();

    const msgData = { from:'user', text:'', senderName:_chatName, createdAt:now, status:'sent' };
    if (type === 'image') {
      msgData.type = 'image'; msgData.imageUrl = url;
    } else {
      msgData.type = 'file'; msgData.fileUrl = url;
      msgData.fileName = file.name; msgData.fileSize = file.size;
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

function _truncName(s, max) {
  s = s || ''; max = max || 36;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function _ticks(data) {
  if (data.from !== 'user') return '';
  const isRead = _unreadAdmin === 0;
  return isRead
    ? '<span class="msg-ticks msg-ticks--read" aria-label="Leído">✓✓</span>'
    : '<span class="msg-ticks" aria-label="Enviado">✓</span>';
}

function _buildMsg(data, mid) {
  const isUser  = data.from === 'user';
  const time    = _fmtTime(data.createdAt);
  const ticks   = isUser ? _ticks(data) : '';
  const midAttr = mid ? ` data-mid="${_esc(mid)}"` : '';
  const avatar  = `<div class="msg-avatar" aria-hidden="true"><img src="images/logo soporte.png" alt="" onerror="this.style.display='none'"></div>`;

  // ── Image ──
  if (data.type === 'image' && data.imageUrl) {
    const su  = _esc(data.imageUrl);
    const cap = data.text ? `<div class="msg-img-caption">${_esc(data.text)}</div>` : '';
    if (isUser) return `<div class="msg-row msg-row--user msg-animate"${midAttr}>
      <div class="msg-bubble bubble--user bubble--img">
        <img src="${su}" class="msg-image" alt="Imagen enviada" loading="lazy" onclick="window.open('${su}','_blank')" tabindex="0">
        ${cap}<div class="msg-time">${time}${ticks}</div>
      </div></div>`;
    return `<div class="msg-row msg-row--admin msg-animate"${midAttr}>${avatar}
      <div class="msg-bubble bubble--admin bubble--img">
        <div class="msg-sender">Soporte VirtualGift</div>
        <img src="${su}" class="msg-image" alt="Imagen de soporte" loading="lazy" onclick="window.open('${su}','_blank')" tabindex="0">
        ${cap}<div class="msg-time">${time}</div>
      </div></div>`;
  }

  // ── File card ──
  if (data.type === 'file' && data.fileUrl) {
    const raw  = data.fileName || 'Archivo';
    const ext  = raw.split('.').pop().toUpperCase() || 'FILE';
    const size = data.fileSize
      ? (data.fileSize < 1048576
          ? (data.fileSize / 1024).toFixed(1) + ' KB'
          : (data.fileSize / 1048576).toFixed(1) + ' MB')
      : '';
    const su   = _esc(data.fileUrl);
    const card = `<div class="msg-file-card" onclick="window.open('${su}','_blank')" role="button" tabindex="0" aria-label="Descargar ${_esc(raw)}">
      <div class="msg-file-icon" aria-hidden="true">📎</div>
      <div class="msg-file-info">
        <div class="msg-file-name">${_esc(_truncName(raw, 34))}</div>
        <div class="msg-file-meta">${_esc(ext)}${size ? ' · ' + size : ''}</div>
      </div>
      <div class="msg-file-dl" aria-hidden="true">⬇</div>
    </div>`;
    if (isUser) return `<div class="msg-row msg-row--user msg-animate"${midAttr}>
      <div class="msg-file-wrap">${card}<div class="msg-time msg-time--file">${time}${ticks}</div></div></div>`;
    return `<div class="msg-row msg-row--admin msg-animate"${midAttr}>${avatar}
      <div class="msg-file-wrap">
        <div class="msg-sender" style="margin-bottom:4px">Soporte VirtualGift</div>
        ${card}<div class="msg-time msg-time--file msg-time--admin">${time}</div>
      </div></div>`;
  }

  // ── Text ──
  const body = _esc(data.text || '').replace(/\n/g, '<br>');
  if (isUser) return `<div class="msg-row msg-row--user msg-animate"${midAttr}>
    <div class="msg-bubble bubble--user">
      <div>${body}</div><div class="msg-time">${time}${ticks}</div>
    </div></div>`;
  return `<div class="msg-row msg-row--admin msg-animate"${midAttr}>${avatar}
    <div class="msg-bubble bubble--admin">
      <div class="msg-sender">Soporte VirtualGift</div>
      <div>${body}</div><div class="msg-time">${time}</div>
    </div></div>`;
}

// ── TICKET BAR ─────────────────────────────────────
function _ticketBarHTML() {
  const map = {
    open:    { label:'Abierto',     s:'open'    },
    waiting: { label:'En revisión', s:'waiting' },
    replied: { label:'Respondido',  s:'replied' },
    closed:  { label:'Cerrado',     s:'closed'  },
  };
  const cfg = map[_chatStatus] || map.waiting;
  const num = _chatUid ? _chatUid.slice(0,8).toUpperCase() : '——';
  return `<div class="ticket-bar" id="ticketBar" role="status" aria-label="Ticket ${num}">
    <span class="ticket-icon" aria-hidden="true">🎫</span>
    <span class="ticket-num">#${num}</span>
    <span class="ticket-sep" aria-hidden="true">·</span>
    <span class="ticket-dot" data-s="${cfg.s}" aria-hidden="true"></span>
    <span class="ticket-badge" data-s="${cfg.s}">${cfg.label}</span>
  </div>`;
}

// ── TYPING ROW ─────────────────────────────────────
function _typingRowHTML() {
  return `<div class="chat-typing-row" id="chatTypingRow" role="status" aria-label="Soporte está escribiendo" aria-live="polite">
    <div class="msg-avatar" aria-hidden="true"><img src="images/logo soporte.png" alt="" onerror="this.style.display='none'"></div>
    <div class="chat-typing-bubble" aria-hidden="true">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div>
  </div>`;
}

// ── SURVEY (única fuente de renderizado) ───────────
function renderSurvey() {
  if (_surveyRated) return;
  if (document.getElementById('chatSurvey')) return;
  const cc = document.getElementById('chatContent');
  if (!cc) return;
  const html = `<div class="chat-survey msg-animate" id="chatSurvey" role="form" aria-label="Encuesta de satisfacción">
    <div class="chat-survey-title">¿Tu problema fue resuelto? 🤔</div>
    <div class="chat-survey-sub">Tu opinión nos ayuda a mejorar el soporte de VirtualGift.</div>
    <div class="survey-stars" role="group" aria-label="Calificación de 1 a 5 estrellas">
      ${[1,2,3,4,5].map(function(n){
        return `<button class="survey-star" type="button" data-r="${n}" onclick="window.chatSelectStar(${n})" aria-label="${n} estrella${n>1?'s':''}" aria-pressed="false">⭐</button>`;
      }).join('')}
    </div>
    <textarea class="survey-comment" id="surveyComment" rows="2" placeholder="Comentario opcional (máx. 300 chars)…" maxlength="300" aria-label="Comentario opcional"></textarea>
    <button class="survey-submit" id="surveySubmit" type="button" onclick="window.chatSubmitSurvey()">Enviar calificación</button>
    <div class="survey-done" id="surveyDone" role="status" aria-live="polite">¡Gracias por tu opinión! 🎉</div>
  </div>`;
  cc.insertAdjacentHTML('beforeend', html);
  if (_isNearBottom(cc)) _scrollToBottom(cc, true);
}

function removeSurvey() {
  document.getElementById('chatSurvey')?.remove();
}

window.chatSelectStar = function (n) {
  _surveyRating = n;
  document.querySelectorAll('.survey-star').forEach(function (el) {
    const active = parseInt(el.dataset.r) <= n;
    el.classList.toggle('sel', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
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
    const done  = document.getElementById('surveyDone');
    const stars = document.querySelector('.survey-stars');
    const cmt   = document.getElementById('surveyComment');
    if (done)  done.style.display  = 'block';
    if (stars) stars.style.display = 'none';
    if (cmt)   cmt.style.display   = 'none';
    if (btn)   btn.style.display   = 'none';
    _toast('¡Gracias por tu calificación! 🎉', 'ok');
  } catch (e) {
    console.error('[chat] submitSurvey:', e);
    if (btn) btn.disabled = false;
    _toast('Error al enviar. Intenta de nuevo.', 'error');
  }
};

// ── SUBSCRIBE MESSAGES (render incremental) ────────
function subscribeMessages() {
  if (_unsubMsgs) _unsubMsgs();
  const cc = document.getElementById('chatContent');
  if (!cc) return;

  _renderedMsgIds.clear();
  _lastRenderedDate = null;

  _unsubMsgs = window.db
    .collection('supportChats').doc(_chatUid)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(function (snap) {
      if (!cc) return;

      if (!snap.empty && !_inChatView) window.chatShowChat();

      // ── Empty state ──
      if (snap.empty) {
        _renderedMsgIds.clear();
        _lastRenderedDate = null;
        cc.innerHTML = _ticketBarHTML()
          + `<div class="chat-welcome">
               <div class="chat-welcome-title">¡Bienvenido al soporte! 👋</div>
               <div class="chat-welcome-text">Cuéntanos cómo podemos ayudarte hoy.<br>Nuestro equipo responde en minutos.</div>
             </div>`;
        return;
      }

      // ── First full render ──
      if (_renderedMsgIds.size === 0) {
        _lastRenderedDate = null;
        let html = _ticketBarHTML()
          + `<div class="chat-divider" role="separator">Inicio de conversación</div>`
          + `<div class="chat-welcome">
               <div class="chat-welcome-title">Soporte VirtualGift</div>
               <div class="chat-welcome-text">Estamos aquí para ayudarte. Responderemos lo antes posible.</div>
             </div>`;

        snap.docs.forEach(function (d) {
          const data    = d.data();
          const dateKey = _getDateKey(data.createdAt);
          if (dateKey && dateKey !== _lastRenderedDate) {
            html += _dateSepHTML(data.createdAt);
            _lastRenderedDate = dateKey;
          }
          html += _buildMsg(data, d.id);
          _renderedMsgIds.add(d.id);
        });

        const isClosed = _chatStatus === 'closed';
        html += _typingRowHTML();
        html += `<div class="chat-closed-banner" id="chatClosedBanner"${isClosed ? '' : ' style="display:none"'}>
          🔒 Esta conversación fue cerrada por el equipo de soporte.
        </div>`;

        cc.innerHTML = html;
        if (isClosed && !_surveyRated) renderSurvey();
        requestAnimationFrame(function () { _scrollToBottom(cc); });

      } else {
        // ── Incremental: append new messages only ──
        const nearBottom = _isNearBottom(cc);
        let addedNew = false;

        snap.docChanges().forEach(function (change) {
          if (change.type === 'added' && !_renderedMsgIds.has(change.doc.id)) {
            const data    = change.doc.data();
            const dateKey = _getDateKey(data.createdAt);
            let   chunk   = '';
            if (dateKey && dateKey !== _lastRenderedDate) {
              chunk += _dateSepHTML(data.createdAt);
              _lastRenderedDate = dateKey;
            }
            chunk += _buildMsg(data, change.doc.id);
            _renderedMsgIds.add(change.doc.id);
            addedNew = true;

            // Insert before typing / closed / survey anchors
            const anchor = document.getElementById('chatTypingRow')
                        || document.getElementById('chatClosedBanner')
                        || document.getElementById('chatSurvey');
            if (anchor) anchor.insertAdjacentHTML('beforebegin', chunk);
            else        cc.insertAdjacentHTML('beforeend', chunk);

          } else if (change.type === 'modified') {
            // Refresh tick status on modified message
            const el = cc.querySelector(`[data-mid="${change.doc.id}"]`);
            if (el) {
              const tickEl = el.querySelector('.msg-ticks');
              if (tickEl) {
                const isRead = _unreadAdmin === 0;
                tickEl.className = isRead ? 'msg-ticks msg-ticks--read' : 'msg-ticks';
                tickEl.textContent = '✓✓';
                tickEl.setAttribute('aria-label', isRead ? 'Leído' : 'Enviado');
              }
            }
          }
        });

        // Refresh ticket bar text in place
        const tb = document.getElementById('ticketBar');
        if (tb) tb.outerHTML = _ticketBarHTML();

        if (addedNew) {
          if (nearBottom) {
            requestAnimationFrame(function () { _scrollToBottom(cc, true); });
            _showScrollBtn(false);
          } else {
            _showScrollBtn(true);
          }
        }
      }

      // Mark messages as read (use set+merge to avoid error if doc missing)
      window.db.collection('supportChats').doc(_chatUid)
        .set({ unreadUser: 0 }, { merge: true }).catch(function () {});

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

      // Delivery ticks: when admin reads all messages
      _prevUnreadAdmin = _unreadAdmin;
      _unreadAdmin     = data.unreadAdmin || 0;
      if (_prevUnreadAdmin > 0 && _unreadAdmin === 0) {
        document.querySelectorAll('.msg-ticks').forEach(function (el) {
          el.classList.add('msg-ticks--read');
          el.textContent = '✓✓';
          el.setAttribute('aria-label', 'Leído');
        });
      }

      // Status-change toasts (skip first load)
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

      // Centralised header update
      _updateHeaderStatus();

      // Ticket badge
      const badge = document.querySelector('.ticket-badge');
      if (badge) {
        const map = { open:'Abierto', waiting:'En revisión', replied:'Respondido', closed:'Cerrado' };
        badge.textContent  = map[newStatus] || map.waiting;
        badge.dataset.s    = newStatus;
      }
      const dot = document.querySelector('.ticket-dot');
      if (dot) dot.dataset.s = newStatus;

      // Closed banner
      const closedBanner = document.getElementById('chatClosedBanner');
      if (closedBanner) closedBanner.style.display = isClosed ? '' : 'none';

      // Input state
      const input   = document.getElementById('chatInput');
      const sendBtn = document.getElementById('chatSendBtn');
      const fileBtn = document.querySelector('label[for="chatFileInput"]');
      if (isClosed) {
        if (input)   { input.disabled = true; input.placeholder = 'Chat cerrado'; }
        if (sendBtn)  sendBtn.disabled = true;
        if (fileBtn)  fileBtn.style.pointerEvents = 'none';
      } else {
        if (input)   { input.disabled = false; input.placeholder = 'Escríbenos…'; }
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
          if (cc && _isNearBottom(cc)) _scrollToBottom(cc, true);
        }
      }

      // Survey — single source: renderSurvey / removeSurvey
      if (data.rating) { _surveyRated = true; removeSurvey(); }
      if (isClosed && !_surveyRated) renderSurvey();
      else if (!isClosed)            removeSurvey();

    }, function () {});
}

// ── TOAST ──────────────────────────────────────────
function _toast(msg, type) {
  const el = document.getElementById('chatToast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'chat-toast' + (type === 'error' ? ' t-error' : type === 'ok' ? ' t-ok' : '');
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

  // Scroll-to-bottom button
  const scrollBtn = document.getElementById('chatScrollBtn');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', function () {
      const cc = document.getElementById('chatContent');
      if (cc) _scrollToBottom(cc, true);
      _showScrollBtn(false);
    });
  }

  // Hide scroll btn when user scrolls to bottom
  const cc = document.getElementById('chatContent');
  if (cc) {
    cc.addEventListener('scroll', function () {
      if (_isNearBottom(cc)) _showScrollBtn(false);
    }, { passive: true });
  }

  // If user already has messages, go directly to chat view
  window.db.collection('supportChats').doc(_chatUid)
    .collection('messages').limit(1).get()
    .then(function (snap) {
      if (!snap.empty) window.chatShowChat();
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
