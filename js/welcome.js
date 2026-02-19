// js/welcome.js
// ✅ Usa window.waitForFirebase global (firebase-config.js)
// ✅ withAppFlag en todas las redirecciones
// ✅ Sin alert() nativo
// ✅ Sin isFirebaseReady/waitForFirebase duplicadas

const POINTS_CACHE_KEY      = "vg_points_cache";
const POINTS_CACHE_DURATION = 2 * 60 * 1000; // 2 min

document.addEventListener("DOMContentLoaded", () => {
  const userNameElem   = document.getElementById("userName");
  const userPointsElem = document.getElementById("userPoints");
  const welcomeTitle   = document.querySelector(".welcome-title");
  const welcomeMessage = document.getElementById("welcome-message");
  const continueBtn    = document.getElementById("continue-btn");
  const container      = document.querySelector(".welcome-container");

  /* ------------------------------------------ */
  /* withAppFlag fallback                         */
  /* ------------------------------------------ */
  if (typeof window.withAppFlag !== "function") {
    window.withAppFlag = function(url) {
      const isAndroidApp =
        document.documentElement.classList.contains("android-app") ||
        document.body.classList.contains("android-app");
      if (!isAndroidApp) return url;
      if (url.includes("app=android")) return url;
      const parts = url.split("#");
      const base  = parts[0];
      const hash  = parts[1] ? "#" + parts[1] : "";
      const fixed = base.includes("?") ? base + "&app=android" : base + "?app=android";
      return fixed + hash;
    };
  }

  /* ------------------------------------------ */
  /* Modal email no verificado (reemplaza alert) */
  /* ------------------------------------------ */
  function showEmailModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById("vg-email-modal");
      const btn   = document.getElementById("vg-email-modal-ok");
      if (!modal || !btn) { resolve(); return; }

      modal.style.display = "flex";

      const onOk = () => {
        modal.style.display = "none";
        btn.removeEventListener("click", onOk);
        resolve();
      };
      btn.addEventListener("click", onOk);
    });
  }

  /* ------------------------------------------ */
  /* Mensajes de bienvenida                       */
  /* ------------------------------------------ */
  const mensajes = [
    "😊 Nos alegra verte. Continúa tu aventura y gana más recompensas 🎁",
    "🚀 Prepárate para jugar, ganar y llevarte grandes recompensas.",
    "🎁 Hoy tenemos muchas recompensas para ti. ¿Qué esperas para entrar? 🤩",
    "👾 Nos alegra verte de nuevo. ¡La suerte y las recompensas te esperan! 🍀",
    "🔥 ¿Listo para otra ronda? Sigue explorando y consigue más recompensas 🏆",
  ];

  /* ------------------------------------------ */
  /* Utils                                        */
  /* ------------------------------------------ */
  function safeNumber(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function getCachedPoints() {
    try {
      const cached = localStorage.getItem(POINTS_CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      const age  = Date.now() - data.timestamp;
      if (age < POINTS_CACHE_DURATION) return safeNumber(data.points, 0);
      return null;
    } catch { return null; }
  }

  function setCachedPoints(points) {
    try {
      localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify({
        points:    safeNumber(points, 0),
        timestamp: Date.now(),
      }));
    } catch {}
  }

  /* ------------------------------------------ */
  /* Animación de puntos                          */
  /* ------------------------------------------ */
  function animatePoints(finalPoints) {
    if (!userPointsElem) return;
    const final     = safeNumber(finalPoints, 0);
    const duration  = 900;
    const steps     = 45;
    const increment = final / steps;
    let current = 0, step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) { current = final; clearInterval(timer); }
      userPointsElem.textContent = Math.floor(current).toLocaleString();
    }, duration / steps);
  }

  /* ------------------------------------------ */
  /* Caché inmediato (evita mostrar 0)            */
  /* ------------------------------------------ */
  const cached = getCachedPoints();
  if (cached !== null) animatePoints(cached);

  /* ------------------------------------------ */
  /* Partículas (solo en desktop/hover)           */
  /* ------------------------------------------ */
  function createParticles() {
    if (!container) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = document.createElement("div");
        p.style.cssText = `
          position:absolute; width:4px; height:4px;
          background:var(--warning-color,#fbbf24); border-radius:50%;
          pointer-events:none;
          top:${Math.random() * 100}%; left:${Math.random() * 100}%;
          animation:particleFloat 1s ease-out forwards; z-index:-1;
        `;
        container.appendChild(p);
        setTimeout(() => p.remove(), 1000);
      }, i * 70);
    }
  }

  if (!document.getElementById("particle-float-style")) {
    const style = document.createElement("style");
    style.id = "particle-float-style";
    style.textContent = `
      @keyframes particleFloat {
        0%   { opacity:1; transform:translateY(0) scale(1); }
        100% { opacity:0; transform:translateY(-48px) scale(0); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------ */
  /* Botón continuar                              */
  /* ------------------------------------------ */
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      continueBtn.classList.add("loading");
      continueBtn.innerHTML = 'Cargando... <i class="fas fa-spinner fa-spin"></i>';
      // ✅ withAppFlag en la redirección
      setTimeout(() => { window.location.href = withAppFlag("inicio.html"); }, 600);
    });

    // Partículas solo en dispositivos que soportan hover (desktop)
    const supportsHover = window.matchMedia("(hover:hover)").matches;
    if (supportsHover) {
      continueBtn.addEventListener("mouseenter", createParticles);
    }
  }

  // Scale en container solo en desktop (en móvil es molesto y puede causar layout shift)
  if (container && window.matchMedia("(hover:hover)").matches) {
    container.addEventListener("mouseenter", () => { container.style.transform = "scale(1.02)"; });
    container.addEventListener("mouseleave", () => { container.style.transform = "scale(1)"; });
  }

  /* ------------------------------------------ */
  /* Auth + Firestore                             */
  /* ------------------------------------------ */

  // ✅ Usa window.waitForFirebase global del firebase-config.js
  window.waitForFirebase((err) => {
    if (err) {
      console.error("[welcome] Firebase timeout");
      // Mostrar lo que tengamos en caché y dejar al usuario continuar
      if (userNameElem)   userNameElem.textContent   = "Usuario";
      if (welcomeMessage) welcomeMessage.textContent = mensajes[0];
      animatePoints(cached ?? 0);
      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      // Sin usuario → login
      if (!user) {
        window.location.href = withAppFlag("index.html"); // ✅
        return;
      }

      // Verificación de email (solo para cuentas con contraseña)
      if (!user.emailVerified && user.providerData?.[0]?.providerId === "password") {
        await showEmailModal(); // ✅ sin alert nativo
        await firebase.auth().signOut();
        window.location.href = withAppFlag("index.html"); // ✅
        return;
      }

      const db      = firebase.firestore();
      const userRef = db.collection("users").doc(user.uid);

      try {
        const snap     = await userRef.get();
        const provider = (() => {
          const pid = user.providerData?.[0]?.providerId || "password";
          return pid === "password" ? "email" : pid;
        })();

        if (!snap.exists) {
          // Primera vez — crear documento
          await userRef.set({
            uid:                  user.uid,
            displayName:          user.displayName || "Usuario",
            username:             user.displayName || "Usuario",
            email:                user.email || "",
            provider,
            photoURL:             user.photoURL || "",
            points:               100,
            level:                1,
            experience:           0,
            nextLevel:            200,
            gamesPlayed:          0,
            achievements:         0,
            sorteosParticipados:  0,
            createdAt:            firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin:            firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          if (welcomeTitle)   welcomeTitle.textContent   = "¡Bienvenido!";
          if (welcomeMessage) welcomeMessage.textContent =
            "¡Bienvenido por primera vez! Estás a punto de comenzar una increíble aventura llena de recompensas y diversión.";
        } else {
          // Usuario existente — actualizar lastLogin
          await userRef.set({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          if (welcomeMessage) {
            welcomeMessage.textContent = mensajes[Math.floor(Math.random() * mensajes.length)];
          }
        }

        // Leer datos finales y actualizar UI
        const finalSnap = await userRef.get();
        const data      = finalSnap.data() || {};

        const displayName = data.displayName || data.username || user.displayName || "Usuario";
        if (userNameElem) userNameElem.textContent = displayName;

        const points = safeNumber(data.points, 0);
        setCachedPoints(points);
        animatePoints(points);

      } catch (err) {
        console.error("[welcome] Error Firestore:", err);

        // Fallback: datos de auth + caché (nunca mostrar 100 por defecto)
        if (userNameElem)   userNameElem.textContent   = user.displayName || "Usuario";
        if (welcomeMessage) welcomeMessage.textContent = mensajes[Math.floor(Math.random() * mensajes.length)];

        animatePoints(cached !== null ? cached : 0);
      }
    });
  });
});
