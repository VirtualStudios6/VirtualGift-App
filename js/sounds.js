// sounds.js — VirtualGift Sound System
// Web Audio API synthesis — no audio files needed
(function () {
  'use strict';

  var _ctx = null;
  var _prevUnread = -1; // para detectar nuevas notificaciones

  function ctx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function enabled() {
    return localStorage.getItem('vg_sounds') !== 'off';
  }

  // Tono base: oscilador con envelope ADSR simple
  function tone(c, freq, start, dur, vol, type) {
    var osc = c.createOscillator();
    var g   = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  var VGSounds = {

    // ── Ganar coins (anuncios) ──────────────────────────────
    // Arpegio ascendente C5 → E5 → G5
    coin: function () {
      var c = ctx(); if (!c || !enabled()) return;
      var t = c.currentTime;
      tone(c, 523, t,        0.18, 0.22, 'sine');
      tone(c, 659, t + 0.10, 0.18, 0.22, 'sine');
      tone(c, 784, t + 0.20, 0.28, 0.26, 'sine');
      // shimmer final: tono suave más agudo
      tone(c, 1047, t + 0.30, 0.20, 0.10, 'sine');
    },

    // ── Canjear premio (puntos) ─────────────────────────────
    // Fanfarria ascendente C5 → E5 → G5 → C6
    prize: function () {
      var c = ctx(); if (!c || !enabled()) return;
      var t = c.currentTime;
      tone(c, 523,  t,        0.22, 0.20, 'sine');
      tone(c, 659,  t + 0.14, 0.22, 0.20, 'sine');
      tone(c, 784,  t + 0.28, 0.22, 0.22, 'sine');
      tone(c, 1047, t + 0.44, 0.50, 0.24, 'sine');
      // acorde final junto con el C6
      tone(c, 784,  t + 0.44, 0.50, 0.14, 'sine');
      tone(c, 659,  t + 0.44, 0.50, 0.10, 'sine');
    },

    // ── Inscribirse en sorteo ───────────────────────────────
    // Acorde mayor G4+B4+D5 simultáneo — "¡Estás dentro!"
    join: function () {
      var c = ctx(); if (!c || !enabled()) return;
      var t = c.currentTime;
      tone(c, 392, t, 0.55, 0.16, 'sine'); // G4
      tone(c, 494, t, 0.55, 0.14, 'sine'); // B4
      tone(c, 587, t, 0.55, 0.18, 'sine'); // D5
      // nota de énfasis un poco después
      tone(c, 784, t + 0.18, 0.30, 0.14, 'sine'); // G5
    },

    // ── Copiar código / enlace ──────────────────────────────
    // Doble tick sutil y rápido
    copy: function () {
      var c = ctx(); if (!c || !enabled()) return;
      var t = c.currentTime;
      tone(c, 1200, t,        0.06, 0.11, 'sine');
      tone(c, 1600, t + 0.05, 0.07, 0.09, 'sine');
    },

    // ── Nueva notificación ──────────────────────────────────
    // Ping suave de dos tonos
    notif: function () {
      var c = ctx(); if (!c || !enabled()) return;
      var t = c.currentTime;
      tone(c, 880,  t,        0.22, 0.13, 'sine');
      tone(c, 1100, t + 0.17, 0.20, 0.11, 'sine');
    },

    // ── Utilidades ──────────────────────────────────────────
    enable:    function () { localStorage.setItem('vg_sounds', 'on');  },
    disable:   function () { localStorage.setItem('vg_sounds', 'off'); },
    toggle:    function () {
      if (enabled()) { this.disable(); return false; }
      else           { this.enable();  return true;  }
    },
    isEnabled: enabled,

    // Llamado por notification-badge.js para detectar notifs nuevas
    checkNotifBadge: function (unreadCount) {
      if (_prevUnread >= 0 && unreadCount > _prevUnread) {
        this.notif();
      }
      _prevUnread = unreadCount;
    }
  };

  // Desbloquear AudioContext en iOS (requiere gesto del usuario)
  function unlock() {
    var c = ctx();
    if (c && c.state === 'suspended') c.resume();
  }
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('click',      unlock, { once: true, passive: true });

  window.VGSounds = VGSounds;
})();
