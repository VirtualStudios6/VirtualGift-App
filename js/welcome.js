// js/welcome.js
// ✅ Compatible con welcome.html nuevo
// ✅ Bienvenida inteligente: primer login vs retorno
// ✅ Sin alert() nativo — usa modal custom
// ✅ Sin dependencia de Font Awesome

const POINTS_CACHE_KEY      = "vg_points_cache";
const POINTS_CACHE_DURATION = 2 * 60 * 1000;

document.addEventListener("DOMContentLoaded", () => {
  const userNameElem   = document.getElementById("userName");
  const userPointsElem = document.getElementById("userPoints");
  const welcomeMessage = document.getElementById("welcome-message");
  const continueBtn    = document.getElementById("continue-btn");
  const dividerLabel   = document.querySelector(".divider span");
  const avatarWrap     = document.querySelector(".user-avatar-wrap");

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
  /* Modal email no verificado                    */
  /* ------------------------------------------ */
  function showEmailModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById("vg-email-modal");
      const btn   = document.getElementById("vg-email-modal-ok");
      if (!modal || !btn) { resolve(); return; }
      modal.style.display = "flex";
      modal.classList.add("visible");
      const onOk = () => {
        modal.style.display = "none";
        modal.classList.remove("visible");
        btn.removeEventListener("click", onOk);
        resolve();
      };
      btn.addEventListener("click", onOk);
    });
  }

  /* ------------------------------------------ */
  /* Mensajes                                     */
  /* ------------------------------------------ */
  function getMsgFirstTime(name) {
    return `¡Bienvenido a VirtualGift, ${name}! 🎉 Estamos contentos de tenerte aquí. Explora, juega y gana recompensas increíbles.`;
  }

  const RETURN_MSGS = [
    (n) => `¡Hola de nuevo, ${n}! 👋 Qué bueno verte otra vez. ¿Listo para seguir ganando?`,
    (n) => `¡De vuelta, ${n}! 🔥 Tus recompensas te están esperando.`,
    (n) => `Hola ${n} 🚀 ¿Preparado para otra ronda de diversión y premios?`,
    (n) => `¡${n}, sigues aquí! 🏆 Sigue así y acumula más coins.`,
    (n) => `¡Bienvenido de vuelta, ${n}! 🎁 Hoy puede ser tu día de suerte.`,
  ];

  function getMsgReturn(name) {
    return RETURN_MSGS[Math.floor(Math.random() * RETURN_MSGS.length)](name);
  }

  /* ------------------------------------------ */
  /* Aplicar UI según si es primer login o no     */
  /* ------------------------------------------ */
  function applyFirstTimeUI(name) {
    if (dividerLabel)   dividerLabel.textContent  = "¡Primera vez aquí!";
    if (avatarWrap)     avatarWrap.textContent     = "🎉";
    if (welcomeMessage) welcomeMessage.textContent = getMsgFirstTime(name);
  }

  function applyReturnUI(name) {
    if (dividerLabel)   dividerLabel.textContent  = "¡Hola de nuevo!";
    if (avatarWrap)     avatarWrap.textContent     = "👋";
    if (welcomeMessage) welcomeMessage.textContent = getMsgReturn(name);
  }

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
      if (Date.now() - data.timestamp < POINTS_CACHE_DURATION) return safeNumber(data.points, 0);
      return null;
    } catch { return null; }
  }

  function setCachedPoints(points) {
    try {
      localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify({
        points: safeNumber(points, 0), timestamp: Date.now(),
      }));
    } catch {}
  }

  function animatePoints(finalPoints) {
    if (!userPointsElem) return;
    const final = safeNumber(finalPoints, 0);
    const steps = 45;
    const inc   = final / steps;
    let current = 0, step = 0;
    const timer = setInterval(() => {
      step++; current += inc;
      if (step >= steps) { current = final; clearInterval(timer); }
      userPointsElem.textContent = Math.floor(current).toLocaleString();
    }, 900 / steps);
  }

  const cached = getCachedPoints();
  if (cached !== null) animatePoints(cached);

  /* ------------------------------------------ */
  /* Botón continuar — SVG spinner sin FA         */
  /* ------------------------------------------ */
  const SPINNER_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation:btnSpin .7s linear infinite;vertical-align:middle">
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
    <path d="M12 3a9 9 0 0 1 9 9" stroke="white" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

  // Inyectar keyframe si no existe
  if (!document.getElementById("btn-spin-style")) {
    const s = document.createElement("style");
    s.id = "btn-spin-style";
    s.textContent = "@keyframes btnSpin { to { transform: rotate(360deg); } }";
    document.head.appendChild(s);
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      continueBtn.disabled = true;
      continueBtn.innerHTML = `Cargando… ${SPINNER_SVG}`;
      setTimeout(() => { window.location.href = withAppFlag("inicio.html"); }, 600);
    });
  }

  /* ------------------------------------------ */
  /* Auth + Firestore                             */
  /* ------------------------------------------ */
  window.waitForFirebase((err) => {
    if (err) {
      console.error("[welcome] Firebase timeout");
      applyReturnUI("Usuario");
      animatePoints(cached ?? 0);
      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) { window.location.href = withAppFlag("index.html"); return; }

      // Solo verificar email si es registro con email/contraseña
      if (!user.emailVerified && user.providerData?.[0]?.providerId === "password") {
        await showEmailModal();
        await firebase.auth().signOut();
        window.location.href = withAppFlag("index.html");
        return;
      }

      const db      = firebase.firestore();
      const userRef = db.collection("users").doc(user.uid);

      try {
        const snap     = await userRef.get();
        const prevData = snap.exists ? (snap.data() || {}) : {};

        const loginCount  = safeNumber(prevData.loginCount, 0);
        const isFirstTime = !snap.exists || loginCount === 0;

        const provider = (() => {
          const pid = user.providerData?.[0]?.providerId || "password";
          return pid === "password" ? "email" : pid;
        })();

        if (isFirstTime) {
          await userRef.set({
            uid:                 user.uid,
            displayName:         user.displayName || "Usuario",
            username:            user.displayName || "Usuario",
            email:               user.email || "",
            provider,
            photoURL:            user.photoURL || "",
            points:              prevData.points ?? 175,
            level:               prevData.level  ?? 1,
            experience:          prevData.experience ?? 0,
            nextLevel:           prevData.nextLevel  ?? 200,
            gamesPlayed:         prevData.gamesPlayed ?? 0,
            achievements:        prevData.achievements ?? 0,
            sorteosParticipados: prevData.sorteosParticipados ?? 0,
            loginCount:          1,
            createdAt:           prevData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin:           firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          const name = user.displayName || "Usuario";
          if (userNameElem) userNameElem.textContent = name;
          applyFirstTimeUI(name);

        } else {
          await userRef.set({
            lastLogin:  firebase.firestore.FieldValue.serverTimestamp(),
            loginCount: loginCount + 1,
          }, { merge: true });

          const name = prevData.displayName || prevData.username || user.displayName || "Usuario";
          if (userNameElem) userNameElem.textContent = name;
          applyReturnUI(name);
        }

        // Obtener puntos actualizados
        const finalSnap = await userRef.get();
        const data      = finalSnap.data() || {};
        const points    = safeNumber(data.points, 0);
        setCachedPoints(points);
        animatePoints(points);

      } catch (e) {
        console.error("[welcome] Firestore error:", e);
        const name = user.displayName || "Usuario";
        if (userNameElem) userNameElem.textContent = name;
        applyReturnUI(name);
        animatePoints(cached !== null ? cached : 0);
      }
    });
  });
});
