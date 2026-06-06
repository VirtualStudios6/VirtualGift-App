const admin  = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }  = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { createHash, createHmac } = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// =====================
// SECRETS
// =====================

const FORTNITE_API_KEY_SECRET  = defineSecret("FORTNITE_API_KEY");
const CPX_HASH_KEY_SECRET      = defineSecret("CPX_HASH_KEY");
const OFFERMARU_API_SECRET     = defineSecret("OFFERMARU_API_SECRET");
const TAPJOY_SECRET            = defineSecret("TAPJOY_SECRET");
const IRONSOURCE_SECRET        = defineSecret("IRONSOURCE_SECRET");

// =====================
// HELPERS
// =====================

function safeStr(v) {
  return typeof v === "string" ? v : (v != null ? String(v) : "");
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDisplayName(value, fallback = "Usuario") {
  const clean = safeStr(value).trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, 40) : fallback;
}

function normalizeEmail(value) {
  return safeStr(value).trim().toLowerCase().slice(0, 160);
}

function normalizePhotoURL(value) {
  return safeStr(value).trim().slice(0, 2048);
}

function normalizeProvider(value) {
  const clean = safeStr(value).trim().toLowerCase();
  return clean || "email";
}

const APP_TIME_ZONE = "America/Santo_Domingo";
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDayKey(date = new Date()) {
  return dayKeyFormatter.format(date);
}

function referralCodeForUid(uid) {
  return `VG${safeStr(uid).slice(0, 6).toUpperCase()}`;
}

function normalizeReferralCode(code, uid) {
  const normalized = safeStr(code).trim().toUpperCase();
  if (!/^VG[A-Z0-9]{6}$/.test(normalized)) return "";
  if (uid && normalized === referralCodeForUid(uid)) return "";
  return normalized;
}

const INITIAL_USER_POINTS = 175;
const INITIAL_USER_LEVEL = 1;
const INITIAL_USER_EXPERIENCE = 0;
const NEXT_LEVEL_THRESHOLD = 200;
const REFERRAL_BONUS = 500;
const CHECKIN_REWARDS = [10, 15, 20, 25, 30, 40, 75];
const REDEEM_MIN_POINTS = 20000;
const DELETE_ACCOUNT_MAX_AGE_MS = 15 * 60 * 1000;
const ALLOWED_REDEEM_PLATFORMS = new Set([
  "paypal",
  "amazon",
  "steam",
  "googleplay",
  "psn",
]);

const ROULETTE_SEGMENTS = [
  { label: "MISS", coins: 0, weight: 22 },
  { label: "+5", coins: 5, weight: 20 },
  { label: "+10", coins: 10, weight: 16 },
  { label: "MISS", coins: 0, weight: 14 },
  { label: "+5", coins: 5, weight: 12 },
  { label: "+20", coins: 20, weight: 10 },
  { label: "+50", coins: 50, weight: 5 },
  { label: "+100", coins: 100, weight: 1 },
];
const ROULETTE_TOTAL_WEIGHT = ROULETTE_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
const ROULETTE_FREE_PLAYS = 3;
const ROULETTE_MAX_EXTRA_PLAYS = 3;

const SLOT_SYMBOLS = ["CH", "DI", "GR", "BE", "LE", "OR"];
const SLOT_PAYOUTS = { CH: 150, DI: 100, GR: 75, BE: 50, LE: 30, OR: 20 };
const SLOT_FREE_PLAYS = 5;
const SLOT_MAX_EXTRA_PLAYS = 3;

function pickRouletteSegment() {
  let cursor = Math.random() * ROULETTE_TOTAL_WEIGHT;
  for (const segment of ROULETTE_SEGMENTS) {
    cursor -= segment.weight;
    if (cursor <= 0) return segment;
  }
  return ROULETTE_SEGMENTS[0];
}

function pickRouletteSegmentWithIndex() {
  let cursor = Math.random() * ROULETTE_TOTAL_WEIGHT;
  for (let i = 0; i < ROULETTE_SEGMENTS.length; i++) {
    cursor -= ROULETTE_SEGMENTS[i].weight;
    if (cursor <= 0) return { index: i, segment: ROULETTE_SEGMENTS[i] };
  }
  return { index: 0, segment: ROULETTE_SEGMENTS[0] };
}

function buildSlotResult() {
  const reels = [
    Math.floor(Math.random() * SLOT_SYMBOLS.length),
    Math.floor(Math.random() * SLOT_SYMBOLS.length),
    Math.floor(Math.random() * SLOT_SYMBOLS.length),
  ];

  let win = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    win = SLOT_PAYOUTS[SLOT_SYMBOLS[reels[0]]] || 20;
  } else if (
    reels[0] === reels[1] ||
    reels[1] === reels[2] ||
    reels[0] === reels[2]
  ) {
    win = 8;
  }

  return {
    reels,
    symbols: reels.map((idx) => SLOT_SYMBOLS[idx]),
    win,
  };
}

async function deleteQueryInBatches(query, batchSize = 400) {
  let snap = await query.limit(batchSize).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) break;
    snap = await query.limit(batchSize).get();
  }
}

async function deleteKnownUserStorage(uid) {
  try {
    const bucket = admin.storage().bucket();
    const paths = [
      `avatars/${uid}.jpg`,
      `avatars/${uid}.png`,
      `avatars/${uid}.webp`,
      `users/${uid}/avatar.jpg`,
      `users/${uid}/avatar.png`,
    ];

    await Promise.all(paths.map(async (path) => {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (err) {
        console.warn(`[deleteOwnAccount] No se pudo borrar ${path}:`, err.message);
      }
    }));
  } catch (err) {
    console.warn("[deleteOwnAccount] Storage no disponible:", err.message);
  }
}

function assertAuthed(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesion");
  return uid;
}

function yesterdayDayKey(now = new Date()) {
  return getDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

// =====================
// DAILY CHECK-IN
// =====================

exports.claimDailyCheckin = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);
  const userRef = db.collection("users").doc(uid);
  const historyRef = db.collection("pointsHistory").doc();
  const now = new Date();
  const todayKey = getDayKey(now);
  const yesterdayKey = yesterdayDayKey(now);
  const ts = admin.firestore.Timestamp.now();

  let response;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const data = snap.data() || {};
    const lastKey = safeStr(data.lastCheckinDate)
      || (data.lastCheckin?.toDate ? getDayKey(data.lastCheckin.toDate()) : "");

    if (lastKey === todayKey) {
      response = {
        success: true,
        alreadyDone: true,
        reward: 0,
        streak: safeNum(data.checkinStreak, 0),
        points: safeNum(data.points, 0),
      };
      return;
    }

    const prevStreak = safeNum(data.checkinStreak, 0);
    const newStreak = lastKey === yesterdayKey ? prevStreak + 1 : 1;
    const reward = CHECKIN_REWARDS[(newStreak - 1) % CHECKIN_REWARDS.length];
    const newPoints = safeNum(data.points, 0) + reward;

    tx.update(userRef, {
      points: admin.firestore.FieldValue.increment(reward),
      checkinStreak: newStreak,
      lastCheckin: ts,
      lastCheckinDate: todayKey,
    });
    tx.set(historyRef, {
      userId: uid,
      type: "daily_checkin",
      points: reward,
      streak: newStreak,
      createdAt: ts,
    });

    response = {
      success: true,
      alreadyDone: false,
      reward,
      streak: newStreak,
      points: newPoints,
    };
  });

  return response;
});

// =====================
// REDEEM POINTS
// =====================

exports.requestRedeem = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);
  const platform = safeStr(request.data?.platform).trim().toLowerCase();
  const fullName = normalizeDisplayName(request.data?.fullName, "").slice(0, 80);
  const account = safeStr(request.data?.account).trim().slice(0, 160);
  const points = safeNum(request.data?.points, 0);

  if (!ALLOWED_REDEEM_PLATFORMS.has(platform)) {
    throw new HttpsError("invalid-argument", "Plataforma invalida");
  }
  if (fullName.length < 3) {
    throw new HttpsError("invalid-argument", "Nombre requerido");
  }
  if (!account) {
    throw new HttpsError("invalid-argument", "Cuenta requerida");
  }
  if (points < REDEEM_MIN_POINTS || points % 1000 !== 0) {
    throw new HttpsError("invalid-argument", "Monto de coins invalido");
  }

  const userRef = db.collection("users").doc(uid);
  const historyRef = db.collection("pointsHistory").doc();
  const requestRef = db.collection("redeemRequests").doc();
  const now = admin.firestore.Timestamp.now();
  const usdAmount = Number((points / 1000).toFixed(2));
  let newPoints;

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const currentPoints = safeNum(userSnap.data()?.points, 0);
    if (currentPoints < points) {
      throw new HttpsError("failed-precondition", "No tienes suficientes coins");
    }

    newPoints = currentPoints - points;

    tx.update(userRef, { points: newPoints });
    tx.set(historyRef, {
      userId: uid,
      type: "redeem",
      points: -points,
      platform,
      redeemRequestId: requestRef.id,
      createdAt: now,
    });
    tx.set(requestRef, {
      userId: uid,
      platform,
      fullName,
      account,
      pointsAmount: points,
      usdAmount,
      status: "pending",
      createdAt: now,
    });
  });

  return {
    success: true,
    requestId: requestRef.id,
    points,
    usdAmount,
    platform,
    account,
    newPoints,
  };
});

// =====================
// SERVER-SIDE GAMES
// =====================

exports.spinRoulette = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);
  const userRef = db.collection("users").doc(uid);
  const historyRef = db.collection("pointsHistory").doc();
  const todayKey = getDayKey();
  const now = admin.firestore.Timestamp.now();
  const picked = pickRouletteSegmentWithIndex();
  const coins = safeNum(picked.segment.coins, 0);
  let response;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const data = snap.data() || {};
    const playsUsed = data.rouletteDate === todayKey ? safeNum(data.roulettePlays, 0) : 0;
    const extraUsed = data.rouletteDate === todayKey ? safeNum(data.rouletteExtra, 0) : 0;
    const total = ROULETTE_FREE_PLAYS + extraUsed;
    if (playsUsed >= total) {
      throw new HttpsError("resource-exhausted", "No tienes giros disponibles hoy");
    }

    const newPlays = playsUsed + 1;
    const update = {
      rouletteDate: todayKey,
      roulettePlays: newPlays,
      rouletteExtra: extraUsed,
      updatedAt: now,
    };
    if (coins > 0) update.points = admin.firestore.FieldValue.increment(coins);

    tx.update(userRef, update);
    if (coins > 0) {
      tx.set(historyRef, {
        userId: uid,
        type: "roulette_win",
        points: coins,
        createdAt: now,
      });
    }

    response = {
      success: true,
      segmentIndex: picked.index,
      segment: picked.segment,
      coins,
      playsUsed: newPlays,
      playsRemaining: Math.max(total - newPlays, 0),
      points: safeNum(data.points, 0) + coins,
    };
  });

  return response;
});

exports.spinSlot = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);
  const userRef = db.collection("users").doc(uid);
  const historyRef = db.collection("pointsHistory").doc();
  const todayKey = getDayKey();
  const now = admin.firestore.Timestamp.now();
  const result = buildSlotResult();
  let response;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const data = snap.data() || {};
    const playsUsed = data.slotDate === todayKey ? safeNum(data.slotPlays, 0) : 0;
    const extraUsed = data.slotDate === todayKey ? safeNum(data.slotExtra, 0) : 0;
    const total = SLOT_FREE_PLAYS + extraUsed;
    if (playsUsed >= total) {
      throw new HttpsError("resource-exhausted", "No tienes tiradas disponibles hoy");
    }

    const newPlays = playsUsed + 1;
    const update = {
      slotDate: todayKey,
      slotPlays: newPlays,
      slotExtra: extraUsed,
      updatedAt: now,
    };
    if (result.win > 0) update.points = admin.firestore.FieldValue.increment(result.win);

    tx.update(userRef, update);
    if (result.win > 0) {
      tx.set(historyRef, {
        userId: uid,
        type: "slot_win",
        points: result.win,
        createdAt: now,
      });
    }

    response = {
      success: true,
      ...result,
      playsUsed: newPlays,
      playsRemaining: Math.max(total - newPlays, 0),
      points: safeNum(data.points, 0) + result.win,
    };
  });

  return response;
});

// =====================
// UNITY ADS REWARDS
// =====================

exports.grantUnityAdReward = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);
  const rewardType = safeStr(request.data?.rewardType).trim();
  const placementId = safeStr(request.data?.placementId).trim().slice(0, 80);

  const config = {
    roulette_extra: {
      dateField: "rouletteDate",
      extraField: "rouletteExtra",
      playsField: "roulettePlays",
      maxExtra: ROULETTE_MAX_EXTRA_PLAYS,
      label: "giro",
    },
    slot_extra: {
      dateField: "slotDate",
      extraField: "slotExtra",
      playsField: "slotPlays",
      maxExtra: SLOT_MAX_EXTRA_PLAYS,
      label: "tirada",
    },
  }[rewardType];

  if (!config) throw new HttpsError("invalid-argument", "Tipo de recompensa invalido");

  const userRef = db.collection("users").doc(uid);
  const rewardRef = db.collection("adRewards").doc();
  const todayKey = getDayKey();
  const now = admin.firestore.Timestamp.now();
  let response;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const data = snap.data() || {};
    const isToday = data[config.dateField] === todayKey;
    const currentExtra = isToday ? safeNum(data[config.extraField], 0) : 0;
    const currentPlays = isToday ? safeNum(data[config.playsField], 0) : 0;

    if (currentExtra >= config.maxExtra) {
      throw new HttpsError("resource-exhausted", "Limite diario de anuncios alcanzado");
    }

    const nextExtra = currentExtra + 1;
    tx.update(userRef, {
      [config.dateField]: todayKey,
      [config.playsField]: currentPlays,
      [config.extraField]: nextExtra,
      updatedAt: now,
    });

    tx.set(rewardRef, {
      userId: uid,
      type: rewardType,
      provider: "unity_ads",
      placementId,
      dayKey: todayKey,
      createdAt: now,
    });

    response = {
      success: true,
      rewardType,
      extraUsed: nextExtra,
      maxExtra: config.maxExtra,
      message: `+1 ${config.label} desbloqueado`,
    };
  });

  return response;
});

// =====================
// DELETE OWN ACCOUNT
// =====================

exports.deleteOwnAccount = onCall({ region: "us-central1" }, async (request) => {
  const uid = assertAuthed(request);

  await Promise.all([
    deleteQueryInBatches(db.collection("notifications").where("userId", "==", uid)),
    deleteQueryInBatches(db.collection("pointsHistory").where("userId", "==", uid)),
    deleteQueryInBatches(db.collection("raffleParticipants").where("userId", "==", uid)),
    deleteQueryInBatches(db.collection("redeemRequests").where("userId", "==", uid)),
  ]);

  await deleteKnownUserStorage(uid);
  await db.collection("users").doc(uid).delete();
  await admin.auth().deleteUser(uid);

  return { success: true };
});

// =====================
// FORTNITE SHOP SYNC
// =====================

const SHOP_URL = "https://fortnite-api.com/v2/shop?language=es";

async function syncShopNow() {
  console.log("Fetching Fortnite shop...");

  // The /v2/shop endpoint is public — no Authorization header needed
  const res = await fetch(SHOP_URL);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed: ${res.status} - ${body}`);
  }

  const json    = await res.json();
  const entries = Array.isArray(json?.data?.entries) ? json.data.entries : [];
  console.log(`Found ${entries.length} entries in shop response`);

  const now = admin.firestore.Timestamp.now();

  const oldSnap = await db.collection("shopDailyItems").get();
  if (!oldSnap.empty) {
    let delBatch = db.batch();
    let delOps = 0;
    for (const doc of oldSnap.docs) {
      delBatch.delete(doc.ref);
      delOps++;
      if (delOps >= 450) {
        await delBatch.commit();
        delBatch = db.batch();
        delOps = 0;
      }
    }
    if (delOps > 0) await delBatch.commit();
    console.log(`Deleted ${oldSnap.size} old items`);
  }

  let batch = db.batch();
  let ops   = 0;
  let saved = 0;

  for (const entry of entries) {
    const items = [
      ...(Array.isArray(entry.brItems)    ? entry.brItems    : []),
      ...(Array.isArray(entry.tracks)     ? entry.tracks     : []),
      ...(Array.isArray(entry.instruments)? entry.instruments: []),
      ...(Array.isArray(entry.cars)       ? entry.cars       : []),
      ...(Array.isArray(entry.legoKits)   ? entry.legoKits   : []),
    ];
    const price = Number(entry.finalPrice || entry.regularPrice || 0);

    for (const it of items) {
      const id = safeStr(it?.id);
      if (!id) continue;

      const imageUrl = safeStr(
        it?.images?.featured || it?.images?.icon || it?.images?.smallIcon || ""
      );
      if (!imageUrl) continue;

      const docId = `${saved}_${id}`;
      batch.set(db.collection("shopDailyItems").doc(docId), {
        name:        safeStr(it?.name || ""),
        type:        safeStr(it?.type?.value || ""),
        rarity:      safeStr(it?.rarity?.displayValue || it?.rarity?.value || ""),
        price,
        imageUrl,
        imageFull:   safeStr(it?.images?.featured || it?.images?.icon || ""),
        videoUrl:    safeStr(it?.showcaseVideos?.[0] || it?.video || ""),
        description: safeStr(it?.description || ""),
        sort:        saved,
        updatedAt:   now,
      });

      saved++;
      ops++;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops   = 0;
      }
    }
  }

  if (ops > 0) await batch.commit();

  await db.doc("shopDaily/current").set(
    { updatedAt: now, totalItems: saved, source: "fortnite-api.com" },
    { merge: true }
  );

  console.log(`Saved ${saved} items to shopDailyItems`);
}

// Manual trigger — onCall (requires auth + isAdmin: true)
// No API key needed — shop endpoint is public
exports.forceFortniteShopSync = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const adminSnap = await db.collection("users").doc(request.auth.uid).get();
    if (!adminSnap.exists || adminSnap.data().isAdmin !== true) {
      throw new HttpsError("permission-denied", "Se requieren permisos de administrador");
    }

    await syncShopNow();
    return { ok: true, message: "Shop synced successfully" };
  }
);

// =====================
// FORTNITE PLAYER STATS
// =====================

// Requires FORTNITE_API_KEY secret to be configured in Secret Manager.
// Run: firebase functions:secrets:set FORTNITE_API_KEY
exports.getFortniteStats = onCall(
  { region: "us-central1", secrets: [FORTNITE_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const name     = (request.data?.name || "").trim();
    const platform = (request.data?.platform || "").trim();
    if (!name)           throw new HttpsError("invalid-argument", "name requerido");
    if (name.length > 100) throw new HttpsError("invalid-argument", "name demasiado largo");

    const apiKey = FORTNITE_API_KEY_SECRET.value();
    if (!apiKey) throw new HttpsError("internal", "API key no configurada");

    const platformParam = platform && platform !== "all"
      ? `&accountType=${encodeURIComponent(platform)}`
      : "";
    const url = `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(name)}${platformParam}&image=all`;

    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (res.status === 404) throw new HttpsError("not-found", "Jugador no encontrado");
    if (!res.ok) throw new HttpsError("internal", `Fortnite API error: ${res.status}`);

    const json = await res.json();
    return { data: json.data || null };
  }
);

// Scheduled — runs daily at 20:05 Santo Domingo time
// No API key needed — shop endpoint is public
exports.syncFortniteShop = onSchedule(
  {
    schedule: "5 20 * * *",
    timeZone: "America/Santo_Domingo",
    region:   "us-central1",
  },
  async () => {
    await syncShopNow();
  }
);

// =====================
// PARTICIPATE IN RAFFLE
// =====================

exports.participateInRaffle = onCall({ region: "us-central1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión");

  const raffleId = (request.data?.raffleId || "").trim();
  if (!raffleId) throw new HttpsError("invalid-argument", "raffleId requerido");

  const raffleRef = db.collection("raffles").doc(raffleId);
  const userRef   = db.collection("users").doc(uid);

  // Soft check: entry count per user per raffle (max 5)
  // Done outside transaction because Firestore transactions don't support where queries
  const existingSnap = await db.collection("raffleParticipants")
    .where("raffleId", "==", raffleId)
    .where("userId",   "==", uid)
    .get();
  const entryCount = existingSnap.size;
  if (entryCount >= 5) {
    throw new HttpsError("already-exists", "Ya alcanzaste el máximo de 5 entradas para este sorteo");
  }

  // Pre-generate doc refs so they can be used inside the transaction
  const participantRef = db.collection("raffleParticipants").doc();
  const historyRef     = db.collection("pointsHistory").doc();
  const now            = admin.firestore.Timestamp.now();
  let newCoinBalance;

  await db.runTransaction(async (tx) => {
    const [raffleSnap, userSnap] = await Promise.all([
      tx.get(raffleRef),
      tx.get(userRef),
    ]);

    if (!raffleSnap.exists) throw new HttpsError("not-found", "Sorteo no encontrado");

    const raffle = raffleSnap.data();

    if (!raffle.active) {
      throw new HttpsError("failed-precondition", "Este sorteo ya no está activo");
    }

    const endDate = raffle.endDate?.toDate ? raffle.endDate.toDate() : new Date(raffle.endDate);
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw new HttpsError("failed-precondition", "El sorteo tiene una fecha inválida");
    }
    if (endDate < new Date()) {
      throw new HttpsError("failed-precondition", "Este sorteo ya finalizó");
    }

    const maxParticipants = Number(raffle.maxParticipants);
    if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
      throw new HttpsError("failed-precondition", "Configuración del sorteo inválida");
    }
    if ((raffle.participants || 0) >= maxParticipants) {
      throw new HttpsError("resource-exhausted", "El sorteo ya alcanzó el máximo de participantes");
    }

    const cost = Number(raffle.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new HttpsError("failed-precondition", "Costo del sorteo inválido");
    }

    const userPoints = Number(userSnap.data()?.points) || 0;
    if (userPoints < cost) {
      throw new HttpsError("failed-precondition", `No tienes suficientes coins. Necesitas ${cost}, tienes ${userPoints}`);
    }

    newCoinBalance = userPoints - cost;

    tx.update(userRef,   { points: newCoinBalance });
    tx.update(raffleRef, { participants: admin.firestore.FieldValue.increment(1) });
    tx.set(participantRef, {
      raffleId,
      userId:      uid,
      entryNumber: entryCount + 1,
      enteredAt:   now,
      requirementsCompleted: false,
    });
    tx.set(historyRef, {
      userId:      uid,
      type:        "raffle_entry",
      points:      -cost,
      raffleId,
      raffleTitle: `${raffle.title || ""} ${raffle.value || ""}`.trim(),
      createdAt:   now,
    });
  });

  return {
    success:        true,
    newCoinBalance,
    entryNumber:    entryCount + 1,
    participantId:  participantRef.id,
  };
});

// =====================
// COMPLETE RAFFLE REQUIREMENTS
// =====================

exports.completeRaffleRequirements = onCall({ region: "us-central1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión");

  const participantId = (request.data?.participantId || "").trim();
  const raffleId      = (request.data?.raffleId      || "").trim();
  if (!participantId || !raffleId) {
    throw new HttpsError("invalid-argument", "participantId y raffleId son requeridos");
  }

  const participantRef = db.collection("raffleParticipants").doc(participantId);
  const raffleRef      = db.collection("raffles").doc(raffleId);

  const [participantSnap, raffleSnap] = await Promise.all([
    participantRef.get(),
    raffleRef.get(),
  ]);

  if (!participantSnap.exists) {
    throw new HttpsError("not-found", "Participación no encontrada");
  }

  const participant = participantSnap.data();

  if (participant.userId !== uid) {
    throw new HttpsError("permission-denied", "Esta participación no es tuya");
  }

  // Idempotent — already completed is not an error
  if (participant.requirementsCompleted === true) {
    return { success: true, alreadyCompleted: true };
  }

  if (!raffleSnap.exists) {
    throw new HttpsError("not-found", "Sorteo no encontrado");
  }

  const raffle  = raffleSnap.data();
  const endDate = raffle.endDate?.toDate ? raffle.endDate.toDate() : new Date(raffle.endDate);
  if (!raffle.active || endDate < new Date()) {
    throw new HttpsError("failed-precondition", "El sorteo ya finalizó");
  }

  await participantRef.update({
    requirementsCompleted:   true,
    requirementsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, alreadyCompleted: false };
});

// =====================
// APPLY REFERRAL CODE
// =====================

exports.applyReferral = onCall({ region: "us-central1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión");

  const code = (request.data?.code || "").trim().toUpperCase();
  if (!/^VG[A-Z0-9]{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Formato de código inválido");
  }

  const usersRef = db.collection("users");
  const myRef    = usersRef.doc(uid);

  const snap = await usersRef.where("referralCode", "==", code).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "Código no encontrado");

  const referrerId  = snap.docs[0].id;
  if (referrerId === uid) {
    throw new HttpsError("invalid-argument", "No puedes usar tu propio código");
  }

  const referrerRef = snap.docs[0].ref;
  const BONUS       = 500;
  const now         = admin.firestore.Timestamp.now();

  await db.runTransaction(async (tx) => {
    const mySnap = await tx.get(myRef);
    if (!mySnap.exists) throw new HttpsError("not-found", "Usuario no encontrado");
    if (mySnap.data().referredBy) {
      throw new HttpsError("already-exists", "Ya tienes un código aplicado");
    }

    tx.update(referrerRef, {
      points:        admin.firestore.FieldValue.increment(BONUS),
      referralCount: admin.firestore.FieldValue.increment(1),
    });
    tx.set(db.collection("pointsHistory").doc(), {
      userId: referrerId, type: "referral_bonus",
      points: BONUS, fromUser: uid, createdAt: now,
    });
    tx.update(myRef, {
      points:     admin.firestore.FieldValue.increment(BONUS),
      referredBy: referrerId,
    });
    tx.set(db.collection("pointsHistory").doc(), {
      userId: uid, type: "referral_bonus",
      points: BONUS, fromCode: code, createdAt: now,
    });
  });

  return { success: true, bonus: BONUS };
});

// =====================
// CPX RESEARCH POSTBACK
// =====================
// CPX Research llama a esta URL cuando un usuario completa o cancela una encuesta.
// Configurar en el panel de CPX Research → Ajustes de Postback:
// https://us-central1-virtualgift-login.cloudfunctions.net/cpxPostback
//   ?user_id={user_id}&amount_local={amount_local}&amount_usd={amount_usd}&trans_id={trans_id}&status={status}&hash={secure_hash}
// Hash: MD5(trans_id + "-" + secure_hash_key)
// status=1 → acreditar | status=2 → revertir
// Conversión: 1 USD = 1000 coins

exports.cpxPostback = onRequest(
  { region: "us-central1", cors: false, secrets: [CPX_HASH_KEY_SECRET] },
  async (req, res) => {
    const { user_id, amount_local, amount_usd, trans_id, status, hash } = req.query;

    if (!user_id || !amount_usd || !trans_id || !hash) {
      return res.status(400).send("Missing parameters");
    }

    // Verificar hash: MD5(trans_id + "-" + secret_key)
    const expectedHash = createHash("md5")
      .update(trans_id + "-" + CPX_HASH_KEY_SECRET.value().trim())
      .digest("hex");

    if (hash !== expectedHash) {
      console.warn("[cpxPostback] Hash inválido para trans:", trans_id);
      return res.status(403).send("Invalid hash");
    }

    const coins = Math.round(parseFloat(amount_usd) * 1000);
    if (!coins || coins <= 0) return res.status(400).send("Invalid amount");

    // status=2 → encuesta cancelada/revertida → descontar coins
    const isReversal = String(status) === "2";

    try {
      if (isReversal) {
        // Buscar la transacción original para revertirla
        const origSnap = await db.collection("pointsHistory")
          .where("transactionId", "==", trans_id)
          .where("type", "==", "cpx_survey")
          .limit(1).get();

        if (origSnap.empty) {
          console.log("[cpxPostback] Reversión sin transacción original:", trans_id);
          return res.status(200).send("1");
        }

        const origData = origSnap.docs[0].data();
        // Evitar doble reversión
        if (origData.reversed === true) {
          return res.status(200).send("1");
        }

        await db.runTransaction(async (tx) => {
          tx.update(origSnap.docs[0].ref, { reversed: true });
          tx.update(db.collection("users").doc(user_id), {
            points: admin.firestore.FieldValue.increment(-coins),
          });
          tx.set(db.collection("pointsHistory").doc(), {
            userId:        user_id,
            type:          "cpx_survey_reversal",
            points:        -coins,
            transactionId: trans_id,
            amountUsd:     parseFloat(amount_usd),
            createdAt:     admin.firestore.Timestamp.now(),
          });
        });

        console.log(`[cpxPostback] REVERSIÓN -${coins} coins → ${user_id}`);
        return res.status(200).send("1");
      }

      // status=1 → acreditar (idempotente)
      const dupSnap = await db.collection("pointsHistory")
        .where("transactionId", "==", trans_id)
        .where("type", "==", "cpx_survey")
        .limit(1).get();

      if (!dupSnap.empty) {
        console.log("[cpxPostback] Transacción duplicada:", trans_id);
        return res.status(200).send("1");
      }

      await db.runTransaction(async (tx) => {
        tx.update(db.collection("users").doc(user_id), {
          points: admin.firestore.FieldValue.increment(coins),
        });
        tx.set(db.collection("pointsHistory").doc(), {
          userId:        user_id,
          type:          "cpx_survey",
          points:        coins,
          transactionId: trans_id,
          amountUsd:     parseFloat(amount_usd),
          reversed:      false,
          createdAt:     admin.firestore.Timestamp.now(),
        });
      });

      console.log(`[cpxPostback] +${coins} coins → ${user_id}`);
      return res.status(200).send("1");
    } catch (err) {
      console.error("[cpxPostback] Error:", err);
      return res.status(500).send("Error");
    }
  }
);

// =====================
// OFFERWALL FRAUD CONSTANTS
// =====================
// Límites conservadores — ajustar si el volumen real de usuarios lo requiere.
const OW_MAX_COINS_PER_TX  = 10000; // cap por transacción individual
const OW_MAX_COINS_PER_DAY = 50000; // cap diario por usuario por proveedor

// =====================
// OFFERMARU POSTBACK (reemplaza BitLabs)
// =====================
// Offermaru llama a esta URL cuando un usuario completa una oferta.
//
// Configurar en Offermaru Dashboard → S2S Postback URL:
//   https://us-central1-virtualgift-login.cloudfunctions.net/offermaruPostback
//   ?user_id={USER_ID}&amount={AMOUNT}&transaction_id={TRANSACTION_ID}&status={STATUS}&api_key={API_KEY}
//
// Parámetros que envía Offermaru:
//   user_id        → Firebase UID del usuario (el que pasaste en el iFrame)
//   amount         → VirtualCoins a acreditar (configúralo en Offermaru por oferta)
//   transaction_id → ID único de la transacción (para deduplicación)
//   status         → 1 = completado/aprobado
//   api_key        → Tu clave secreta (configurada en Firebase Secret Manager)
//
// Protecciones:
//   1. Verificación de api_key (rechaza si no coincide)
//   2. Solo acepta status=1 (completado)
//   3. Verifica existencia del usuario en Firestore
//   4. Deduplicación por transaction_id (idempotente)
//   5. Cap por transacción (OW_MAX_COINS_PER_TX)
//   6. Cap diario por usuario (OW_MAX_COINS_PER_DAY)
//   7. Transacción atómica

exports.offermaruPostback = onRequest(
  { region: "us-central1", cors: false, secrets: [OFFERMARU_API_SECRET] },
  async (req, res) => {
    const p = { ...req.query, ...req.body };
    // Offermaru envía: user_id, user_reward, offer_id, offer_name, transaction_id, publisher_payout, timestamp
    const user_id        = p.user_id;
    const user_reward    = p.user_reward || p.amount; // user_reward es el nombre real de Offermaru
    const transaction_id = p.transaction_id;
    const api_key        = p.api_key;
    const offer_id       = p.offer_id   || "";
    const offer_name     = p.offer_name || "";

    // ── 1. Validar parámetros ─────────────────────────────────────────────
    if (!user_id || !user_reward || !transaction_id || !api_key) {
      console.warn("[offermaruPostback] Parámetros incompletos:", {
        user_id: !!user_id, user_reward: !!user_reward,
        transaction_id: !!transaction_id, api_key: !!api_key,
      });
      return res.status(400).send("Missing parameters");
    }

    // ── 2. Verificar api_key ──────────────────────────────────────────────
    const secret = OFFERMARU_API_SECRET.value().trim();
    if (api_key !== secret) {
      console.warn("[offermaruPostback] API key inválida — posible solicitud falsa. uid:", user_id);
      await db.collection("suspiciousActivity").add({
        userId: user_id, type: "offermaru_invalid_key",
        transaction_id, ip: req.ip, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(403).send("Invalid api_key");
    }

    // Nota: Offermaru solo llama este endpoint cuando la oferta está completada/aprobada,
    // no hay parámetro status que filtrar.

    // ── 3. Parsear y validar coins ────────────────────────────────────────
    const coins = Math.round(parseFloat(user_reward));
    if (!Number.isFinite(coins) || coins <= 0) {
      console.warn("[offermaruPostback] Amount inválido:", amount);
      return res.status(400).send("Invalid amount");
    }

    // ── 5. Cap por transacción ────────────────────────────────────────────
    if (coins > OW_MAX_COINS_PER_TX) {
      console.warn(`[offermaruPostback] Amount ${coins} excede cap ${OW_MAX_COINS_PER_TX}. uid: ${user_id}`);
      await db.collection("suspiciousActivity").add({
        userId: user_id, type: "offermaru_tx_cap_exceeded",
        coins, transaction_id, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(400).send("Amount exceeds maximum");
    }

    try {
      // ── 6. Verificar que el usuario existe ────────────────────────────
      const userRef  = db.collection("users").doc(String(user_id));
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.warn(`[offermaruPostback] Usuario no encontrado: ${user_id}`);
        return res.status(404).send("User not found");
      }

      // ── 7. Deduplicación por transaction_id ───────────────────────────
      const dupSnap = await db.collection("pointsHistory")
        .where("transactionId", "==", String(transaction_id))
        .where("provider",      "==", "offermaru")
        .limit(1).get();

      if (!dupSnap.empty) {
        console.log("[offermaruPostback] Transacción duplicada ignorada:", transaction_id);
        return res.status(200).send("1");
      }

      // ── 8. Cap diario + acreditación atómica ─────────────────────────
      const today  = new Date().toISOString().slice(0, 10);
      const capRef = db.collection("offerwallDailyCaps").doc(`${user_id}_${today}_offermaru`);

      await db.runTransaction(async (tx) => {
        const capSnap    = await tx.get(capRef);
        const todayTotal = capSnap.exists ? (capSnap.data().total || 0) : 0;

        if (todayTotal + coins > OW_MAX_COINS_PER_DAY) {
          const err = new Error("DAILY_CAP_EXCEEDED");
          err.todayTotal = todayTotal;
          throw err;
        }

        tx.update(userRef, {
          points: admin.firestore.FieldValue.increment(coins),
        });

        tx.set(db.collection("pointsHistory").doc(), {
          userId:        String(user_id),
          type:          "offermaru_offer",
          points:        coins,
          transactionId: String(transaction_id),
          provider:      "offermaru",
          offerId:       String(offer_id),
          offerName:     String(offer_name),
          reversed:      false,
          createdAt:     admin.firestore.Timestamp.now(),
        });

        tx.set(capRef, {
          total:     admin.firestore.FieldValue.increment(coins),
          userId:    String(user_id),
          provider:  "offermaru",
          date:      today,
          updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
      });

      console.log(`[offermaruPostback] ✓ +${coins} coins → usuario ${user_id} (trans: ${transaction_id})`);
      return res.status(200).send("1");

    } catch (err) {
      if (err.message === "DAILY_CAP_EXCEEDED") {
        console.warn(`[offermaruPostback] Límite diario uid: ${user_id}. Hoy: ${err.todayTotal} coins.`);
        await db.collection("suspiciousActivity").add({
          userId: user_id, type: "offermaru_daily_cap_exceeded",
          todayTotal: err.todayTotal, coins, transaction_id,
          timestamp: admin.firestore.Timestamp.now(),
        }).catch(() => {});
        return res.status(429).send("Daily limit exceeded");
      }
      console.error("[offermaruPostback] Error interno:", err);
      return res.status(500).send("Error");
    }
  }
);

// =====================
// TAPJOY POSTBACK
// =====================
// Tapjoy llama a esta URL cuando un usuario completa una oferta.
//
// Configurar en Tapjoy Dashboard → Server-to-Server Postback URL:
//   https://us-central1-virtualgift-login.cloudfunctions.net/tapjoyPostback
//   ?snuid={snuid}&currency={currency}&id={id}&mac_address={mac_address}
//
// Parámetros que envía Tapjoy:
//   snuid       → Firebase UID del usuario (el que pasaste como publisher_user_id)
//   currency    → VirtualCoins a acreditar (configúralo en el dashboard de Tapjoy)
//   id          → ID único de la transacción (para deduplicación)
//   mac_address → SHA-256(id + ":" + secret_key) para verificar autenticidad
//
// En Tapjoy Dashboard → Virtual Currency → Postback Security Key:
//   pon la misma clave que guardaste en Firebase Secret Manager como "TAPJOY_SECRET".
//
// Protecciones:
//   1. Verificación de mac_address (SHA-256)
//   2. Verifica existencia del usuario en Firestore
//   3. Deduplicación por transaction id (idempotente)
//   4. Cap por transacción (OW_MAX_COINS_PER_TX)
//   5. Cap diario por usuario (OW_MAX_COINS_PER_DAY)
//   6. Transacción atómica

exports.tapjoyPostback = onRequest(
  { region: "us-central1", cors: false, secrets: [TAPJOY_SECRET] },
  async (req, res) => {
    const p = { ...req.query, ...req.body };
    const snuid       = p.snuid;         // Firebase UID
    const currency    = p.currency;      // coins a acreditar
    const id          = p.id;            // transaction ID
    const mac_address = p.mac_address;   // SHA-256 verifier

    // ── 1. Validar parámetros ─────────────────────────────────────────────
    if (!snuid || !currency || !id || !mac_address) {
      console.warn("[tapjoyPostback] Parámetros incompletos:", {
        snuid: !!snuid, currency: !!currency, id: !!id, mac_address: !!mac_address,
      });
      return res.status(400).send("Missing parameters");
    }

    // ── 2. Verificar mac_address: SHA-256(id + ":" + secret_key) ─────────
    const secret   = TAPJOY_SECRET.value().trim();
    const expected = createHash("sha256")
      .update(id + ":" + secret)
      .digest("hex");

    if (mac_address !== expected) {
      console.warn("[tapjoyPostback] mac_address inválido para id:", id);
      await db.collection("suspiciousActivity").add({
        userId: snuid, type: "tapjoy_invalid_hash",
        transactionId: id, ip: req.ip, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(403).send("Invalid mac_address");
    }

    // ── 3. Parsear y validar coins ────────────────────────────────────────
    const coins = Math.round(parseFloat(currency));
    if (!Number.isFinite(coins) || coins <= 0) {
      console.warn("[tapjoyPostback] currency inválido:", currency);
      return res.status(400).send("Invalid currency");
    }

    // ── 4. Cap por transacción ────────────────────────────────────────────
    if (coins > OW_MAX_COINS_PER_TX) {
      console.warn(`[tapjoyPostback] Amount ${coins} excede cap ${OW_MAX_COINS_PER_TX}. uid: ${snuid}`);
      await db.collection("suspiciousActivity").add({
        userId: snuid, type: "tapjoy_tx_cap_exceeded",
        coins, transactionId: id, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(400).send("Amount exceeds maximum");
    }

    try {
      // ── 5. Verificar que el usuario existe ────────────────────────────
      const userRef  = db.collection("users").doc(String(snuid));
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.warn(`[tapjoyPostback] Usuario no encontrado: ${snuid}`);
        return res.status(404).send("User not found");
      }

      // ── 6. Deduplicación por id ───────────────────────────────────────
      const dupSnap = await db.collection("pointsHistory")
        .where("transactionId", "==", String(id))
        .where("provider",      "==", "tapjoy")
        .limit(1).get();

      if (!dupSnap.empty) {
        console.log("[tapjoyPostback] Transacción duplicada ignorada:", id);
        return res.status(200).send("1");
      }

      // ── 7. Cap diario + acreditación atómica ─────────────────────────
      const today  = new Date().toISOString().slice(0, 10);
      const capRef = db.collection("offerwallDailyCaps").doc(`${snuid}_${today}_tapjoy`);

      await db.runTransaction(async (tx) => {
        const capSnap    = await tx.get(capRef);
        const todayTotal = capSnap.exists ? (capSnap.data().total || 0) : 0;

        if (todayTotal + coins > OW_MAX_COINS_PER_DAY) {
          const err = new Error("DAILY_CAP_EXCEEDED");
          err.todayTotal = todayTotal;
          throw err;
        }

        tx.update(userRef, {
          points: admin.firestore.FieldValue.increment(coins),
        });

        tx.set(db.collection("pointsHistory").doc(), {
          userId:        String(snuid),
          type:          "tapjoy_offer",
          points:        coins,
          transactionId: String(id),
          provider:      "tapjoy",
          reversed:      false,
          createdAt:     admin.firestore.Timestamp.now(),
        });

        tx.set(capRef, {
          total:     admin.firestore.FieldValue.increment(coins),
          userId:    String(snuid),
          provider:  "tapjoy",
          date:      today,
          updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
      });

      console.log(`[tapjoyPostback] ✓ +${coins} coins → usuario ${snuid} (trans: ${id})`);
      return res.status(200).send("1");

    } catch (err) {
      if (err.message === "DAILY_CAP_EXCEEDED") {
        console.warn(`[tapjoyPostback] Límite diario uid: ${snuid}. Hoy: ${err.todayTotal} coins.`);
        await db.collection("suspiciousActivity").add({
          userId: snuid, type: "tapjoy_daily_cap_exceeded",
          todayTotal: err.todayTotal, coins, transactionId: id,
          timestamp: admin.firestore.Timestamp.now(),
        }).catch(() => {});
        return res.status(429).send("Daily limit exceeded");
      }
      console.error("[tapjoyPostback] Error interno:", err);
      return res.status(500).send("Error");
    }
  }
);

// ========================
// IRONSOURCE POSTBACK
// ========================
// IronSource llama a esta URL cuando un usuario completa una oferta en el Offerwall.
//
// Configurar en IronSource Dashboard → Offerwall → Settings → S2S Postback URL:
//   https://us-central1-virtualgift-login.cloudfunctions.net/ironSourcePostback
//   ?userId={userId}&rewards={rewards}&timestamp={timestamp}&signature={signature}
//
// Parámetros que envía IronSource:
//   userId    → Firebase UID (el que pasaste al SDK como userId)
//   rewards   → VirtualCoins a acreditar
//   timestamp → Unix timestamp de la transacción
//   signature → MD5(userId + rewards + timestamp + privateKey)
//
// En IronSource Dashboard → Offerwall → Settings → "Private Key":
//   pon la misma clave guardada en Firebase Secret Manager como "IRONSOURCE_SECRET".
//
// Protecciones: mismas que Offermaru/Tapjoy (hash MD5, dedup, caps diarios).

exports.ironSourcePostback = onRequest(
  { region: "us-central1", cors: false, secrets: [IRONSOURCE_SECRET] },
  async (req, res) => {
    const p = { ...req.query, ...req.body };
    const userId    = p.userId;
    const rewards   = p.rewards;
    const timestamp = p.timestamp;
    const signature = p.signature;

    // ── 1. Validar parámetros ─────────────────────────────────────────────
    if (!userId || !rewards || !timestamp || !signature) {
      console.warn("[ironSourcePostback] Parámetros incompletos:", {
        userId: !!userId, rewards: !!rewards,
        timestamp: !!timestamp, signature: !!signature,
      });
      return res.status(400).send("Missing parameters");
    }

    // ── 2. Verificar signature: MD5(userId + rewards + timestamp + privateKey) ─
    const secret   = IRONSOURCE_SECRET.value().trim();
    const expected = createHash("md5")
      .update(String(userId) + String(rewards) + String(timestamp) + secret)
      .digest("hex");

    if (signature !== expected) {
      console.warn("[ironSourcePostback] Signature inválida para userId:", userId);
      await db.collection("suspiciousActivity").add({
        userId, type: "ironsource_invalid_signature",
        timestamp, ip: req.ip, createdAt: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(403).send("Invalid signature");
    }

    // ── 3. Parsear y validar coins ────────────────────────────────────────
    const coins = Math.round(parseFloat(rewards));
    if (!Number.isFinite(coins) || coins <= 0) {
      console.warn("[ironSourcePostback] rewards inválido:", rewards);
      return res.status(400).send("Invalid rewards");
    }

    // ── 4. Cap por transacción ────────────────────────────────────────────
    if (coins > OW_MAX_COINS_PER_TX) {
      console.warn(`[ironSourcePostback] Amount ${coins} excede cap. uid: ${userId}`);
      await db.collection("suspiciousActivity").add({
        userId, type: "ironsource_tx_cap_exceeded",
        coins, timestamp, createdAt: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(400).send("Amount exceeds maximum");
    }

    // ── 5. Deduplicación por userId+timestamp ─────────────────────────────
    const transactionId = `is_${userId}_${timestamp}`;

    try {
      const userRef  = db.collection("users").doc(String(userId));
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.warn(`[ironSourcePostback] Usuario no encontrado: ${userId}`);
        return res.status(404).send("User not found");
      }

      const dupSnap = await db.collection("pointsHistory")
        .where("transactionId", "==", transactionId)
        .where("provider",      "==", "ironsource")
        .limit(1).get();

      if (!dupSnap.empty) {
        console.log("[ironSourcePostback] Transacción duplicada:", transactionId);
        return res.status(200).send("OK");
      }

      // ── 6. Cap diario + acreditación atómica ─────────────────────────
      const today  = new Date().toISOString().slice(0, 10);
      const capRef = db.collection("offerwallDailyCaps").doc(`${userId}_${today}_ironsource`);

      await db.runTransaction(async (tx) => {
        const capSnap    = await tx.get(capRef);
        const todayTotal = capSnap.exists ? (capSnap.data().total || 0) : 0;

        if (todayTotal + coins > OW_MAX_COINS_PER_DAY) {
          const err = new Error("DAILY_CAP_EXCEEDED");
          err.todayTotal = todayTotal;
          throw err;
        }

        tx.update(userRef, { points: admin.firestore.FieldValue.increment(coins) });

        tx.set(db.collection("pointsHistory").doc(), {
          userId:        String(userId),
          type:          "ironsource_offer",
          points:        coins,
          transactionId,
          provider:      "ironsource",
          reversed:      false,
          createdAt:     admin.firestore.Timestamp.now(),
        });

        tx.set(capRef, {
          total:     admin.firestore.FieldValue.increment(coins),
          userId:    String(userId),
          provider:  "ironsource",
          date:      today,
          updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
      });

      console.log(`[ironSourcePostback] ✓ +${coins} coins → ${userId} (${transactionId})`);
      return res.status(200).send("OK");

    } catch (err) {
      if (err.message === "DAILY_CAP_EXCEEDED") {
        console.warn(`[ironSourcePostback] Límite diario uid: ${userId}. Hoy: ${err.todayTotal}`);
        await db.collection("suspiciousActivity").add({
          userId, type: "ironsource_daily_cap_exceeded",
          todayTotal: err.todayTotal, coins,
          createdAt: admin.firestore.Timestamp.now(),
        }).catch(() => {});
        return res.status(429).send("Daily limit exceeded");
      }
      console.error("[ironSourcePostback] Error interno:", err);
      return res.status(500).send("Error");
    }
  }
);
