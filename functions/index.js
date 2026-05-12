const admin  = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }  = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { createHash, createHmac } = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// =====================
// SECRETS
// =====================

const FORTNITE_API_KEY_SECRET = defineSecret("FORTNITE_API_KEY");
const CPX_HASH_KEY_SECRET     = defineSecret("CPX_HASH_KEY");
const BITLABS_API_SECRET      = defineSecret("BITLABS_API_SECRET");

// =====================
// HELPERS
// =====================

function safeStr(v) {
  return typeof v === "string" ? v : (v != null ? String(v) : "");
}

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
    const delBatch = db.batch();
    oldSnap.forEach((doc) => delBatch.delete(doc.ref));
    await delBatch.commit();
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
// BITLABS POSTBACK
// =====================
// BitLabs llama a esta URL al completar una encuesta/oferta.
// Configurar en el panel BitLabs → SDK → Postback URL:
//   https://us-central1-virtualgift-login.cloudfunctions.net/bitlabsPostback
//   ?uid={uid}&reward={reward}&currency={currency}&trans_id={trans_id}&hash={hash}
//
// Hash: HMAC-SHA1(api_secret, uid + trans_id)  — hex digest
//
// Protecciones implementadas:
//   1. Verificación HMAC-SHA1 (rechaza si hash no coincide)
//   2. Verificación de existencia del usuario en Firestore
//   3. Deduplicación por trans_id (idempotente)
//   4. Cap por transacción (OW_MAX_COINS_PER_TX)
//   5. Cap diario por usuario (OW_MAX_COINS_PER_DAY via offerwallDailyCaps)
//   6. Log de actividad sospechosa en colección suspiciousActivity
//   7. Transacción atómica — nunca se acredita sin registrar en historial

exports.bitlabsPostback = onRequest(
  { region: "us-central1", cors: false, secrets: [BITLABS_API_SECRET] },
  async (req, res) => {
    // Solo aceptar GET/POST (BitLabs usa GET por defecto)
    const p = { ...req.query, ...req.body };
    const { uid, reward, currency, trans_id, hash } = p;

    // ── 1. Validar parámetros ──────────────────────────────────────────────
    if (!uid || !reward || !trans_id || !hash) {
      console.warn("[bitlabsPostback] Parámetros incompletos:", { uid: !!uid, reward: !!reward, trans_id: !!trans_id, hash: !!hash });
      return res.status(400).send("Missing parameters");
    }

    // ── 2. Verificar HMAC-SHA1 ────────────────────────────────────────────
    const secret = BITLABS_API_SECRET.value().trim();
    const expectedHash = createHmac("sha1", secret)
      .update(String(uid) + String(trans_id))
      .digest("hex");

    if (hash !== expectedHash) {
      console.warn("[bitlabsPostback] Hash inválido — posible solicitud falsa. trans_id:", trans_id, "uid:", uid);
      await db.collection("suspiciousActivity").add({
        userId: uid, type: "bitlabs_invalid_hash",
        trans_id, ip: req.ip, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(403).send("Invalid hash");
    }

    // ── 3. Parsear y validar recompensa ───────────────────────────────────
    const coins = Math.round(parseFloat(reward));
    if (!Number.isFinite(coins) || coins <= 0) {
      console.warn("[bitlabsPostback] Recompensa inválida:", reward);
      return res.status(400).send("Invalid reward");
    }

    // ── 4. Cap por transacción ────────────────────────────────────────────
    if (coins > OW_MAX_COINS_PER_TX) {
      console.warn(`[bitlabsPostback] Recompensa ${coins} excede cap ${OW_MAX_COINS_PER_TX}. uid: ${uid}`);
      await db.collection("suspiciousActivity").add({
        userId: uid, type: "bitlabs_tx_cap_exceeded",
        coins, trans_id, timestamp: admin.firestore.Timestamp.now(),
      }).catch(() => {});
      return res.status(400).send("Reward exceeds maximum");
    }

    try {
      // ── 5. Verificar que el usuario existe ────────────────────────────
      const userRef  = db.collection("users").doc(String(uid));
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.warn(`[bitlabsPostback] Usuario no encontrado: ${uid}`);
        return res.status(404).send("User not found");
      }

      // ── 6. Deduplicación por trans_id ─────────────────────────────────
      const dupSnap = await db.collection("pointsHistory")
        .where("transactionId", "==", String(trans_id))
        .where("provider",      "==", "bitlabs")
        .limit(1).get();

      if (!dupSnap.empty) {
        console.log("[bitlabsPostback] Transacción duplicada ignorada:", trans_id);
        return res.status(200).send("1"); // responder 1 para que BitLabs no reintente
      }

      // ── 7. Cap diario via offerwallDailyCaps ──────────────────────────
      const today  = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
      const capRef = db.collection("offerwallDailyCaps").doc(`${uid}_${today}_bitlabs`);

      // Usamos transacción para garantizar atomicidad del cap + acreditación
      await db.runTransaction(async (tx) => {
        const capSnap    = await tx.get(capRef);
        const todayTotal = capSnap.exists ? (capSnap.data().total || 0) : 0;

        if (todayTotal + coins > OW_MAX_COINS_PER_DAY) {
          const err = new Error("DAILY_CAP_EXCEEDED");
          err.todayTotal = todayTotal;
          throw err;
        }

        // Acreditar coins al usuario
        tx.update(userRef, {
          points: admin.firestore.FieldValue.increment(coins),
        });

        // Registrar en historial (fuente de verdad)
        tx.set(db.collection("pointsHistory").doc(), {
          userId:        String(uid),
          type:          "bitlabs_survey",
          points:        coins,
          transactionId: String(trans_id),
          provider:      "bitlabs",
          currency:      String(currency || "coins"),
          reversed:      false,
          createdAt:     admin.firestore.Timestamp.now(),
        });

        // Actualizar cap diario
        tx.set(capRef, {
          total:     admin.firestore.FieldValue.increment(coins),
          userId:    String(uid),
          provider:  "bitlabs",
          date:      today,
          updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
      });

      console.log(`[bitlabsPostback] ✓ +${coins} coins acreditados → usuario ${uid} (trans: ${trans_id})`);
      return res.status(200).send("1");

    } catch (err) {
      if (err.message === "DAILY_CAP_EXCEEDED") {
        console.warn(`[bitlabsPostback] Límite diario alcanzado para uid: ${uid}. Ya tiene ${err.todayTotal} coins hoy.`);
        await db.collection("suspiciousActivity").add({
          userId: uid, type: "bitlabs_daily_cap_exceeded",
          todayTotal: err.todayTotal, coins, trans_id,
          timestamp: admin.firestore.Timestamp.now(),
        }).catch(() => {});
        return res.status(429).send("Daily limit exceeded");
      }
      console.error("[bitlabsPostback] Error interno:", err);
      return res.status(500).send("Error");
    }
  }
);
