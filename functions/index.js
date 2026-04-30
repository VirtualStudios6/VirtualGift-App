const admin  = require("firebase-admin");
const crypto = require("crypto");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }  = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();
const db = admin.firestore();

// =====================
// SECRETS
// =====================

const AYET_POSTBACK_TOKEN_SECRET = defineSecret("AYET_POSTBACK_TOKEN");
const ADGEM_SECRET_KEY_SECRET    = defineSecret("ADGEM_SECRET_KEY");
const FORTNITE_API_KEY_SECRET    = defineSecret("FORTNITE_API_KEY");

// TODO: remove these fallbacks after running `firebase functions:secrets:set` for each secret
const AYET_POSTBACK_TOKEN_FALLBACK = "VG_AYET_2026_4093228_SUPERSECRETO";
const FORTNITE_API_KEY_FALLBACK    = "73ffb01e-97df-46f7-b5ee-4023c5c020f5";

// =====================
// HELPERS
// =====================

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v) {
  return typeof v === "string" ? v : (v != null ? String(v) : "");
}

// AdGem HMAC: SHA256(player_id + amount + transaction_id + secret_key)
// Verify exact order in AdGem dashboard → Postback Settings → Secure Hash
function computeAdgemHash(playerId, amount, transactionId, secretKey) {
  const str = `${playerId}${amount}${transactionId}${secretKey}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

// =====================
// AYET POSTBACK (v2)
// =====================

exports.ayetPostback = onRequest(
  { region: "us-central1", secrets: [AYET_POSTBACK_TOKEN_SECRET] },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      const data = req.method === "POST" ? (req.body || {}) : (req.query || {});

      const userId = String(data.user_id || data.userid || data.subid || "").trim();
      const reward = Math.round(toNumber(data.reward || data.amount || data.payout));
      const txid   = String(data.transaction_id || data.txid || data.click_id || "").trim();
      const token  = String(data.token || "").trim();

      if (!userId) return res.status(400).send("missing user_id");
      if (!txid)   return res.status(400).send("missing txid");
      if (!reward || reward <= 0) return res.status(400).send("invalid reward");

      // Token validation — uses Secret Manager value with fallback
      const expectedToken = AYET_POSTBACK_TOKEN_SECRET.value() || AYET_POSTBACK_TOKEN_FALLBACK;
      if (token !== expectedToken) return res.status(403).send("invalid token");

      const txRef  = db.collection("ayetTransactions").doc(txid);
      const txSnap = await txRef.get();
      if (txSnap.exists) return res.status(200).send("ok (duplicate)");

      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap     = await transaction.get(userRef);
        const currentPoints = userSnap.exists ? (userSnap.data().points || 0) : 0;
        const newPoints    = currentPoints + reward;

        transaction.set(userRef, { points: newPoints }, { merge: true });
        transaction.set(txRef, {
          userId,
          reward,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(db.collection("pointsHistory").doc(), {
          userId,
          type: "ayet_offer",
          points: reward,
          txid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).send("ok");
    } catch (error) {
      console.error(error);
      return res.status(500).send("error");
    }
  }
);

// =====================
// FORTNITE SHOP SYNC
// =====================

const SHOP_URL = "https://fortnite-api.com/v2/shop?language=es";

async function syncShopNow(apiKey) {
  console.log("Fetching Fortnite shop...");

  const res = await fetch(SHOP_URL, {
    headers: { "Authorization": apiKey },
  });

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
exports.forceFortniteShopSync = onCall(
  { region: "us-central1", secrets: [FORTNITE_API_KEY_SECRET] },
  async (request) => {
    // 1. Require authentication
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    // 2. Require isAdmin flag in Firestore
    const adminSnap = await db.collection("users").doc(request.auth.uid).get();
    if (!adminSnap.exists || adminSnap.data().isAdmin !== true) {
      throw new HttpsError("permission-denied", "Se requieren permisos de administrador");
    }

    const apiKey = FORTNITE_API_KEY_SECRET.value() || FORTNITE_API_KEY_FALLBACK;
    await syncShopNow(apiKey);
    return { ok: true, message: "Shop synced successfully" };
  }
);

// Scheduled — runs daily at 20:05 Santo Domingo time
exports.syncFortniteShop = onSchedule(
  {
    schedule: "5 20 * * *",
    timeZone: "America/Santo_Domingo",
    region:   "us-central1",
    secrets:  [FORTNITE_API_KEY_SECRET],
  },
  async () => {
    const apiKey = FORTNITE_API_KEY_SECRET.value() || FORTNITE_API_KEY_FALLBACK;
    await syncShopNow(apiKey);
  }
);

// =====================
// ADGEM POSTBACK (v2)
// =====================

exports.adgemPostback = onRequest(
  { region: "us-central1", secrets: [ADGEM_SECRET_KEY_SECRET] },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      const data = req.method === "POST" ? (req.body || {}) : (req.query || {});

      const userId = String(data.player_id || data.playerid || "").trim();
      const reward = Math.round(Number(data.amount || 0));
      const txid   = String(data.transaction_id || "").trim();

      if (!userId) return res.status(400).send("missing player_id");
      if (!txid)   return res.status(400).send("missing transaction_id");
      if (!reward || reward <= 0) return res.status(400).send("invalid amount");

      // Signature validation — only enforced when secret is configured
      const secretKey = ADGEM_SECRET_KEY_SECRET.value();
      if (secretKey) {
        const receivedHash = String(data.hash || data.sig || "").trim().toLowerCase();
        if (!receivedHash) {
          console.warn("[adgem] missing hash parameter — request rejected");
          return res.status(401).send("missing signature");
        }
        const expectedHash = computeAdgemHash(userId, reward, txid, secretKey);
        if (receivedHash !== expectedHash) {
          console.warn("[adgem] hash mismatch", { received: receivedHash, expected: expectedHash });
          return res.status(401).send("invalid signature");
        }
      } else {
        // Secret not yet configured — log warning and proceed (remove once ADGEM_SECRET_KEY is set)
        console.warn("[adgem] ADGEM_SECRET_KEY not set — skipping hash validation");
      }

      const txRef  = db.collection("adgemTransactions").doc(txid);
      const txSnap = await txRef.get();
      if (txSnap.exists) return res.status(200).send("ok (duplicate)");

      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap      = await transaction.get(userRef);
        const currentPoints = userSnap.exists ? (userSnap.data().points || 0) : 0;
        const newPoints     = currentPoints + reward;

        transaction.set(userRef, { points: newPoints }, { merge: true });
        transaction.set(txRef, {
          userId,
          reward,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(db.collection("pointsHistory").doc(), {
          userId,
          type: "adgem_offer",
          points: reward,
          txid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).send("ok");
    } catch (error) {
      console.error(error);
      return res.status(500).send("error");
    }
  }
);

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
