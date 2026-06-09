/* ============================================ */
/* ADMIN-NEWS.JS - VirtualGift                  */
/* ✅ Sin alert/confirm nativos                 */
/* ✅ withAppFlag en todas las redirecciones    */
/* ✅ Guard admin real (isAdmin === true)       */
/* ✅ Usa window.waitForFirebase global         */
/* ============================================ */

// withAppFlag: fallback si no viene del <head>
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

/* ============================================ */
/* UTILS UI */
/* ============================================ */

const qs = (id) => document.getElementById(id);

function toast(msg, duration = 2600) {
  const el = qs("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => (el.style.display = "none"), duration);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}

function parseGallery(text) {
  return Array.from(
    new Set(
      String(text || "").split(/\n|,/g).map((s) => s.trim()).filter(Boolean)
    )
  );
}

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function setImgPreview(elId, url, placeholder) {
  const box = qs(elId);
  if (!box) return;
  const clean = (url && String(url).trim()) ? String(url).trim() : "";
  if (!clean) {
    box.innerHTML = `<span class="muted">${placeholder}</span>`;
    return;
  }
  box.innerHTML = '<img alt="preview" loading="lazy">';
  const img = box.querySelector("img");
  img.src = clean;
  img.onerror = () => { box.innerHTML = `<span class="muted">No se pudo cargar</span>`; };
}

/* ============================================ */
/* MODALES CUSTOM */
/* ============================================ */

function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay   = qs("vg-confirm-overlay");
    const msgEl     = qs("vg-confirm-msg");
    const btnOk     = qs("vg-confirm-ok");
    const btnCancel = qs("vg-confirm-cancel");

    msgEl.textContent = message;
    overlay.style.display = "flex";

    const cleanup = (result) => {
      overlay.style.display = "none";
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
  });
}

function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = qs("vg-alert-overlay");
    const msgEl   = qs("vg-alert-msg");
    const btnOk   = qs("vg-alert-ok");

    msgEl.textContent = message;
    overlay.style.display = "flex";

    const cleanup = () => {
      overlay.style.display = "none";
      btnOk.removeEventListener("click", cleanup);
      resolve();
    };
    btnOk.addEventListener("click", cleanup);
  });
}

/* ============================================ */
/* GATE UI */
/* ============================================ */

function showGateLoading() {
  qs("gateLoading").style.display  = "flex";
  qs("gateDenied").style.display   = "none";
  qs("adminWrap").style.display    = "none";
}

function showGateDenied() {
  qs("gateLoading").style.display  = "none";
  qs("gateDenied").style.display   = "flex";
  qs("adminWrap").style.display    = "none";
}

function showAdmin() {
  qs("gateLoading").style.display  = "none";
  qs("gateDenied").style.display   = "none";
  qs("adminWrap").style.display    = "block";
}

/* ============================================ */
/* CONTADOR FEED TITLE */
/* ============================================ */

const FEED_MAX = 45;

function updateFeedCounter() {
  const inp = qs("fFeedTitle");
  const c   = qs("feedCounter");
  if (!inp || !c) return;
  const len = (inp.value || "").length;
  c.textContent = `${len}/${FEED_MAX}`;
  c.classList.toggle("warn", len > FEED_MAX);
}

/* ============================================ */
/* BLOQUES */
/* ============================================ */

let blocks = [];

function blockLabel(type) {
  return { p: "Párrafo", h2: "Subtítulo (h2)", img: "Imagen", highlight: "Caja destacada" }[type] || type || "Bloque";
}

function updateBlocksCount() {
  const el = qs("blocksCount");
  if (el) el.textContent = `${blocks.length} bloques`;
  const clearBtn = qs("btnClearBlocks");
  if (clearBtn) clearBtn.disabled = blocks.length === 0;
}

function addBlock(type) {
  if (type === "p")         blocks.push({ type: "p", text: "" });
  if (type === "h2")        blocks.push({ type: "h2", text: "" });
  if (type === "img")       blocks.push({ type: "img", url: "", caption: "" });
  if (type === "highlight") blocks.push({ type: "highlight", text: "" });
  renderBlocks();
}

function moveBlock(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  renderBlocks();
}

function deleteBlock(i) {
  blocks.splice(i, 1);
  renderBlocks();
}

function renderBlocks() {
  const wrap = qs("blocks");
  if (!wrap) return;
  wrap.innerHTML = "";

  blocks.forEach((b, i) => {
    const el = document.createElement("div");
    el.className = "block";

    const head = document.createElement("div");
    head.className = "block-head";
    head.innerHTML = `
      <div class="block-type">
        <span>${escapeHtml(blockLabel(b.type))}</span>
        <span class="block-mini">#${i + 1}</span>
      </div>
      <div class="block-actions">
        <button class="btn" data-act="up"   data-i="${i}">↑</button>
        <button class="btn" data-act="down" data-i="${i}">↓</button>
        <button class="btn btn-danger" data-act="del" data-i="${i}">Eliminar</button>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "block-body";

    if (b.type === "p") {
      body.innerHTML = `<textarea data-field="text" data-i="${i}" placeholder="Escribe el párrafo...">${escapeHtml(b.text || "")}</textarea>`;
    }
    if (b.type === "h2") {
      body.innerHTML = `<input data-field="text" data-i="${i}" placeholder="Ej: ¿Qué se descubrió?" value="${escapeHtml(b.text || "")}">`;
    }
    if (b.type === "highlight") {
      body.innerHTML = `<textarea data-field="text" data-i="${i}" placeholder="Ej: 💡 Dato clave: ...">${escapeHtml(b.text || "")}</textarea>`;
    }
    if (b.type === "img") {
      body.innerHTML = `
        <input data-field="url"     data-i="${i}" placeholder="URL de la imagen" value="${escapeHtml(b.url || "")}">
        <div style="height:8px"></div>
        <input data-field="caption" data-i="${i}" placeholder="Caption (opcional)" value="${escapeHtml(b.caption || "")}">
      `;
    }

    el.appendChild(head);
    el.appendChild(body);
    wrap.appendChild(el);
  });

  updateBlocksCount();
}

// Delegación: clicks en bloques
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.getAttribute("data-act");
  const i   = Number(btn.getAttribute("data-i"));
  if (Number.isNaN(i)) return;
  if (act === "up")   moveBlock(i, -1);
  if (act === "down") moveBlock(i,  1);
  if (act === "del")  deleteBlock(i);
});

// Delegación: inputs en bloques
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t?.id === "fFeedTitle") { updateFeedCounter(); return; }
  const i     = t.getAttribute("data-i");
  const field = t.getAttribute("data-field");
  if (i == null || !field) return;
  const idx = Number(i);
  if (blocks[idx]) blocks[idx][field] = t.value;
});

/* ============================================ */
/* FORM */
/* ============================================ */

function getFormData() {
  return {
    title:          (qs("fTitle")?.value       || "").trim(),
    feedTitle:      (qs("fFeedTitle")?.value   || "").trim(),
    category:       (qs("fCategory")?.value    || "Gaming").trim(),
    published:       qs("fPublished")?.value   === "true",
    headerImageUrl: (qs("fHeaderImage")?.value || "").trim(),
    statusText:     (qs("fStatusText")?.value  || "").trim(),
    coverImageUrl:  (qs("fCover")?.value       || "").trim(),
    gallery:         parseGallery(qs("fGallery")?.value),
  };
}

function normalizeBlocksForSave() {
  return blocks.reduce((acc, b) => {
    const type = String(b?.type || "").trim();
    if (["p", "h2", "highlight"].includes(type)) {
      const text = String(b.text || "").trim();
      if (text) acc.push({ type, text });
    } else if (type === "img") {
      const url = String(b.url || "").trim();
      if (url) {
        const out = { type: "img", url };
        const caption = String(b.caption || "").trim();
        if (caption) out.caption = caption;
        acc.push(out);
      }
    }
    return acc;
  }, []);
}

function fillForm(data) {
  qs("fTitle").value       = data.title       || "";
  qs("fFeedTitle").value   = data.feedTitle   || "";
  qs("fCategory").value    = data.category    || "Gaming";
  qs("fPublished").value   = data.published   === true ? "true" : "false";
  qs("fHeaderImage").value = data.headerImageUrl || "";
  qs("fStatusText").value  = data.statusText  || "";
  qs("fCover").value       = data.coverImageUrl || data.imageUrl || "";
  qs("fGallery").value     = Array.isArray(data.gallery) ? data.gallery.join("\n") : "";

  blocks = Array.isArray(data.blocks) ? JSON.parse(JSON.stringify(data.blocks)) : [];
  renderBlocks();
  updateFeedCounter();

  setImgPreview("headerPreview", qs("fHeaderImage").value, "Vista previa del header");
  setImgPreview("coverPreview",  qs("fCover").value,       "Vista previa del cover");

  const btnDelete   = qs("btnDelete");
  const modeBadge   = qs("modeBadge");
  if (btnDelete)  btnDelete.style.display  = selectedId ? "block" : "none";
  if (modeBadge)  modeBadge.textContent    = selectedId ? "Editar" : "Crear";
}

function resetForm() {
  selectedId = null;
  blocks     = [];
  fillForm({ category: "Gaming", published: true });
}

/* ============================================ */
/* CRUD */
/* ============================================ */

let currentUser  = null;
let selectedId   = null;
let lastDocs     = [];
let currentFilter = "all";
let _dragSrc             = null;
let _dragListenersAdded  = false;

async function saveNews() {
  const data       = getFormData();
  const blocksData = normalizeBlocksForSave();

  if (!data.title)         { await showAlert("⚠️ Pon un título para la noticia."); return; }
  if (!data.coverImageUrl) { await showAlert("⚠️ Pon el cover del feed (URL de imagen)."); return; }
  if (!data.headerImageUrl){ await showAlert("⚠️ Pon la imagen del header (URL)."); return; }
  if (!blocksData.length)  { await showAlert("⚠️ Agrega al menos un bloque de contenido."); return; }

  if ((data.feedTitle || "").length > FEED_MAX) {
    toast("⚠️ El título del feed pasa de 45 caracteres.");
  }

  try {
    const now   = firebase.firestore.FieldValue.serverTimestamp();
    const payload = {
      title:          data.title,
      feedTitle:      data.feedTitle,
      category:       data.category,
      published:      data.published,
      coverImageUrl:  data.coverImageUrl,
      headerImageUrl: data.headerImageUrl,
      statusText:     data.statusText,
      blocks:         blocksData,
      gallery:        data.gallery,
      updatedAt:      now,
    };

    if (data.published) payload.date = now;

    if (!selectedId) {
      const maxSort = lastDocs.reduce((m, { data }) => Math.max(m, typeof data.sort === "number" ? data.sort : 0), 0);
      payload.sort = maxSort + 10;
      payload.createdAt = now;
      const ref = await firebase.firestore().collection("news").add(payload);
      selectedId = ref.id;
      qs("btnDelete").style.display = "block";
      qs("modeBadge").textContent   = "Editar";
      toast("✅ Noticia creada");
    } else {
      await firebase.firestore().collection("news").doc(selectedId).update(payload);
      toast("✅ Noticia actualizada");
    }

    await loadNews();
  } catch (e) {
    console.error("[admin-news] save error:", e);
    await showAlert("❌ No se pudo guardar:\n" + (e.message || String(e)));
  }
}

async function publishNow() {
  if (!selectedId) { toast("Selecciona una noticia primero"); return; }
  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await firebase.firestore().collection("news").doc(selectedId).update({
      published: true, date: now, updatedAt: now,
    });
    if (qs("fPublished")) qs("fPublished").value = "true";
    toast("🚀 Publicada");
    await loadNews();
  } catch (e) {
    console.error("[admin-news] publish error:", e);
    await showAlert("❌ No se pudo publicar:\n" + (e.message || String(e)));
  }
}

async function unpublish() {
  if (!selectedId) { toast("Selecciona una noticia primero"); return; }
  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await firebase.firestore().collection("news").doc(selectedId).update({
      published: false, updatedAt: now,
    });
    if (qs("fPublished")) qs("fPublished").value = "false";
    toast("📦 Despublicada");
    await loadNews();
  } catch (e) {
    console.error("[admin-news] unpublish error:", e);
    await showAlert("❌ No se pudo despublicar:\n" + (e.message || String(e)));
  }
}

async function deleteNews() {
  if (!selectedId) return;
  const confirmed = await showConfirm("¿Eliminar esta noticia?\nEsta acción no se puede deshacer.");
  if (!confirmed) return;
  try {
    await firebase.firestore().collection("news").doc(selectedId).delete();
    toast("🗑 Noticia eliminada");
    resetForm();
    await loadNews();
  } catch (e) {
    console.error("[admin-news] delete error:", e);
    await showAlert("❌ No se pudo eliminar:\n" + (e.message || String(e)));
  }
}

/* ============================================ */
/* LISTA */
/* ============================================ */

async function loadNews() {
  const list  = qs("newsList");
  const empty = qs("emptyState");
  if (list) list.innerHTML = "";
  if (empty) empty.style.display = "none";

  try {
    const snap = await firebase.firestore()
      .collection("news")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    lastDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

    // Asignar sort a noticias que no lo tienen (migración única)
    const needsSort = lastDocs.some(({ data }) => typeof data.sort !== "number");
    if (needsSort) {
      const batch = firebase.firestore().batch();
      lastDocs.forEach(({ id, data }, i) => {
        if (typeof data.sort !== "number") {
          batch.update(firebase.firestore().collection("news").doc(id), { sort: (i + 1) * 10 });
          data.sort = (i + 1) * 10;
        }
      });
      await batch.commit();
    }

    // Ordenar por sort ascendente localmente
    lastDocs.sort((a, b) => (a.data.sort || 0) - (b.data.sort || 0));

    applyFilterAndRender();
  } catch (e) {
    console.error("[admin-news] load error:", e);
    await showAlert("❌ No se pudo cargar la lista:\n" + (e.message || String(e)));
  }
}

function applyFilterAndRender() {
  const list  = qs("newsList");
  const empty = qs("emptyState");

  const filtered = lastDocs.filter(({ data }) => {
    if (currentFilter === "published") return data.published === true;
    if (currentFilter === "drafts")    return data.published !== true;
    return true;
  });

  const badge = qs("countBadge");
  if (badge) badge.textContent = String(filtered.length);

  if (!list) return;
  list.innerHTML = "";

  if (!filtered.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  const isDraggable = currentFilter === "all";

  if (isDraggable) {
    const hint = document.createElement("p");
    hint.className = "drag-hint";
    hint.innerHTML = `<svg viewBox="0 0 10 16" width="8" height="12" fill="currentColor" style="flex-shrink:0"><circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/></svg> Arrastra para reordenar`;
    list.appendChild(hint);
  }

  filtered.forEach(({ id, data }) => {
    const title        = data.title || "Noticia";
    const displayTitle = data.feedTitle || title;
    const cover        = (data.coverImageUrl || data.imageUrl || "").trim();
    const published    = data.published === true;

    const el = document.createElement("div");
    el.className = "item";
    el.dataset.id = id;
    if (isDraggable) el.draggable = true;

    const handleTitle = isDraggable ? 'title="Arrastra para reordenar"' : 'title="Activa el filtro Todas para reordenar"';
    const handleClass = isDraggable ? "drag-handle" : "drag-handle drag-disabled";

    el.innerHTML = `
      <div class="${handleClass}" ${handleTitle}>
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/></svg>
      </div>
      <div class="thumb">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
      </div>
      <div class="meta">
        <strong>${escapeHtml(displayTitle)}</strong>
        <div class="small">
          ${published ? "🟢 Publicada" : "🟡 Borrador"} · ${escapeHtml(data.category || "—")} · ${fmtDate(data.date || data.updatedAt || data.createdAt)}
        </div>
        <div class="item-actions">
          <button class="btn" data-action="edit"  data-id="${id}">Editar</button>
          ${published
            ? `<button class="btn btn-warning" data-action="unpub" data-id="${id}">Despublicar</button>`
            : `<button class="btn btn-success" data-action="pub"   data-id="${id}">Publicar</button>`
          }
          <button class="btn btn-danger" data-action="del"  data-id="${id}">Eliminar</button>
          <button class="btn"            data-action="open" data-id="${id}">Ver</button>
        </div>
      </div>
    `;
    list.appendChild(el);
  });

  // Drag-and-drop listeners (event delegation, se agrega una sola vez)
  if (list && !_dragListenersAdded) {
    _dragListenersAdded = true;
    setupDragAndDrop(list);
  }
}

/* ============================================ */
/* DRAG & DROP                                  */
/* ============================================ */

function setupDragAndDrop(list) {
  list.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".item[draggable]");
    if (!item) return;
    _dragSrc = item;
    item.classList.add("drag-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.id || "");
  });

  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target.closest(".item[draggable]");
    if (!target || target === _dragSrc) return;
    list.querySelectorAll(".item").forEach((el) => el.classList.remove("drag-over"));
    target.classList.add("drag-over");
  });

  list.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || !list.contains(e.relatedTarget)) {
      list.querySelectorAll(".item").forEach((el) => el.classList.remove("drag-over"));
    }
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const target = e.target.closest(".item[draggable]");
    if (!target || !_dragSrc || target === _dragSrc) return;
    list.querySelectorAll(".item").forEach((el) => el.classList.remove("drag-over"));
    const rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      list.insertBefore(_dragSrc, target);
    } else {
      list.insertBefore(_dragSrc, target.nextSibling);
    }
  });

  list.addEventListener("dragend", async () => {
    list.querySelectorAll(".item").forEach((el) => {
      el.classList.remove("drag-dragging", "drag-over");
    });
    if (_dragSrc) {
      _dragSrc = null;
      await saveNewOrder(list);
    }
  });
}

async function saveNewOrder(list) {
  const items = list.querySelectorAll(".item[data-id]");
  if (!items.length) return;
  const batch = firebase.firestore().batch();
  items.forEach((el, i) => {
    const id = el.dataset.id;
    if (!id) return;
    const sortVal = (i + 1) * 10;
    batch.update(firebase.firestore().collection("news").doc(id), { sort: sortVal });
    const found = lastDocs.find((x) => x.id === id);
    if (found) found.data.sort = sortVal;
  });
  try {
    await batch.commit();
    toast("✅ Orden guardado");
  } catch (e) {
    console.error("[admin-news] saveNewOrder:", e);
    toast("❌ No se pudo guardar el orden");
  }
}

// Delegación de clicks en la lista
document.addEventListener("click", async (e) => {
  const btn    = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id     = btn.getAttribute("data-id");
  const found  = lastDocs.find((x) => x.id === id);
  if (!found) return;

  if (action === "edit") {
    selectedId = id;
    fillForm(found.data);
    toast("Editando...");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "pub")   { selectedId = id; await publishNow(); return; }
  if (action === "unpub") { selectedId = id; await unpublish();  return; }
  if (action === "del")   { selectedId = id; await deleteNews(); return; }
  if (action === "open") {
    window.open(withAppFlag(`news.html?id=${encodeURIComponent(id)}`), "_blank");
    return;
  }
});

// Filtros
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.getAttribute("data-filter");
    applyFilterAndRender();
  });
});

/* ============================================ */
/* GUARD ADMIN */
/* ============================================ */

async function checkAndInitAdmin(user) {
  try {
    const doc  = await firebase.firestore().collection("users").doc(user.uid).get();
    const data = doc.data() || {};

    if (data.isAdmin !== true) {
      console.warn("[admin-news] Acceso denegado: isAdmin !== true");
      showGateDenied();
      return;
    }

    currentUser = user;
    showAdmin();
    await loadNews();

    // Auto-open article if URL has ?id=...
    const urlId = new URLSearchParams(window.location.search).get('id');
    if (urlId) {
      const found = lastDocs.find(x => x.id === urlId);
      if (found) {
        selectedId = urlId;
        fillForm(found.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Editando artículo ✏️');
      } else {
        toast('Panel listo ✅');
      }
    } else {
      toast('Panel listo ✅');
    }
  } catch (e) {
    console.error("[admin-news] checkAndInitAdmin error:", e);
    showGateDenied();
  }
}

/* ============================================ */
/* EVENTS */
/* ============================================ */

function bindUI() {
  qs("btnSave")?.addEventListener("click", saveNews);
  qs("btnNew")?.addEventListener("click", resetForm);
  qs("btnPublishNow")?.addEventListener("click", publishNow);
  qs("btnUnpublish")?.addEventListener("click", unpublish);
  qs("btnDelete")?.addEventListener("click", deleteNews);

  qs("fCover")?.addEventListener("input",       (e) => setImgPreview("coverPreview",  e.target.value, "Vista previa del cover"));
  qs("fHeaderImage")?.addEventListener("input", (e) => setImgPreview("headerPreview", e.target.value, "Vista previa del header"));

  qs("btnGoHome")?.addEventListener("click", () => {
    window.location.href = withAppFlag("admin.html");
  });

  qs("btnLogout")?.addEventListener("click", async () => {
    const confirmed = await showConfirm("¿Cerrar sesión?");
    if (!confirmed) return;
    try { await firebase.auth().signOut(); } catch {}
    window.location.href = withAppFlag("login.html");
  });

  qs("addP")?.addEventListener("click",   () => addBlock("p"));
  qs("addH2")?.addEventListener("click",  () => addBlock("h2"));
  qs("addImg")?.addEventListener("click", () => addBlock("img"));
  qs("addHi")?.addEventListener("click",  () => addBlock("highlight"));

  qs("btnClearBlocks")?.addEventListener("click", async () => {
    if (!blocks.length) return;
    const confirmed = await showConfirm("¿Eliminar todos los bloques?\nEsta acción no se puede deshacer.");
    if (!confirmed) return;
    blocks = [];
    renderBlocks();
  });
}

/* ============================================ */
/* INIT */
/* ============================================ */

window.addEventListener("load", () => {
  showGateLoading();
  bindUI();
  resetForm();
  renderBlocks();
  updateFeedCounter();

  // Usa el waitForFirebase global del firebase-config.js
  window.waitForFirebase((err) => {
    if (err) { showGateDenied(); return; }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = withAppFlag("login.html");
        return;
      }
      await checkAndInitAdmin(user);
    });
  });
});
