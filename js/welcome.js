// js/welcome.js
// ✅ Compatible con welcome.html viejo y nuevo
// ✅ Bienvenida inteligente: primer login vs retorno
// ✅ Usa window.waitForFirebase global
// ✅ Sin alert() nativo

const POINTS_CACHE_KEY      = "vg_points_cache";
const POINTS_CACHE_DURATION = 2 * 60 * 1000;

document.addEventListener("DOMContentLoaded", () => {
  const userNameElem   = document.getElementById("userName");
  const userPointsElem = document.getElementById("userPoints");
  const welcomeMessage = document.getElementById("welcome-message");
  const continueBtn    = document.getElementById("continue-btn");
  const welcomeTitle   = document.querySelector(".welcome-title");   // HTML viejo
  const dividerLabel   = document.querySelector(".divider span");    // HTML nuevo
  const avatarWrap     = document.querySelector(".user-avatar-wrap"); // HTML nuevo

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
      // Funciona con HTML viejo (style inline) y nuevo (clase .visible)
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
    return `¡Bienvenido a VirtualGift, ${name}! 🎉 Nos alegra tenerte aquí por primera vez. Explora, juega y gana recompensas increíbles.`;
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
  /* Aplicar UI                                   */
  /* ------------------------------------------ */
  function applyFirstTimeUI(name) {
    if (welcomeTitle)   welcomeTitle.textContent  = "¡Bienvenido!";           // viejo
    if (dividerLabel)   dividerLabel.textContent  = "¡Primera vez aquí!";     // nuevo
    if (avatarWrap)     avatarWrap.textContent     = "🎉";                     // nuevo
    if (welcomeMessage) welcomeMessage.textContent = getMsgFirstTime(name);
  }

  function applyReturnUI(name) {
    if (welcomeTitle)   welcomeTitle.textContent  = "¡Bienvenido de vuelta!"; // viejo
    if (dividerLabel)   dividerLabel.textContent  = "¡Hola de nuevo!";        // nuevo
    if (avatarWrap)     avatarWrap.textContent     = "👋";                     // nuevo
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
  /* Botón continuar                              */
  /* ------------------------------------------ */
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      continueBtn.disabled = true;
      // Compatible con ícono FA (viejo) y SVG (nuevo)
      continueBtn.innerHTML = `Cargando… <i class="fas fa-spinner fa-spin"></i>`;
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

        // isFirstTime: doc no existe, o existe pero nunca tuvo loginCount
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
            points:              prevData.points ?? 100,
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
