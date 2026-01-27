// js/news-feed.js
(function () {
  const MAX_NEWS = 8;

  function isFirebaseReady() {
    return typeof firebase !== "undefined" && firebase.firestore;
  }

  function waitForFirebase(callback, maxAttempts = 60) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (isFirebaseReady()) {
        clearInterval(timer);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.error("Firebase no cargó para news-feed.js");
      }
    }, 100);
  }

  function formatDate(ts) {
    try {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    } catch {
      return "";
    }
  }

  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderNews(container, docs) {
    container.innerHTML = "";

    if (!docs.length) {
      // Si no hay noticias, puedes dejar vacío o mostrar algo bonito
      container.innerHTML = `
        <div style="color:#9ca3af; padding:10px; font-size:14px;">
          No hay noticias publicadas todavía.
        </div>
      `;
      return;
    }

    docs.forEach((doc) => {
      const n = doc.data();
      const title = escapeHtml(n.title || "Noticia");
      const imageUrl = escapeHtml(n.imageUrl || "");
      const dateText = formatDate(n.createdAt);

      // Card compatible con tu diseño actual
      const a = document.createElement("a");
      a.className = "news-card";
      a.href = `news.html?id=${doc.id}`; // 👉 siguiente paso: página detalle
      a.innerHTML = `
        <div class="news-image">
          <img src="${imageUrl}" alt="${title}" onerror="this.style.display='none'">
        </div>
        <p class="news-label">${title}${dateText ? " • " + dateText : ""}</p>
      `;
      container.appendChild(a);
    });
  }

  waitForFirebase(() => {
    const container = document.querySelector(".news-grid");
    if (!container) {
      console.warn("No existe .news-grid en inicio.html");
      return;
    }

    // 🔥 Tiempo real
    firebase
      .firestore()
      .collection("news")
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .limit(MAX_NEWS)
      .onSnapshot(
        (snapshot) => {
          renderNews(container, snapshot.docs);
        },
        (err) => {
          console.error("Error cargando noticias:", err);

          // 🔧 Si sale error de índice, te lo dirá en consola
          container.innerHTML = `
            <div style="color:#ef4444; padding:10px; font-size:14px;">
              Error cargando noticias. Revisa la consola (puede requerir crear un índice en Firestore).
            </div>
          `;
        }
      );
  });
})();
