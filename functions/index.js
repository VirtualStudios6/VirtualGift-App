const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

// =====================
// AYET POSTBACK (v2)
// =====================

const POSTBACK_TOKEN = "VG_AYET_2026_4093228_SUPERSECRETO";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

exports.ayetPostback = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      const data = req.method === "POST" ? (req.body || {}) : (req.query || {});

      const userId = String(data.user_id || data.userid || data.subid || "").trim();
      const reward = Math.round(toNumber(data.reward || data.amount || data.payout));
      const txid = String(data.transaction_id || data.txid || data.click_id || "").trim();
      const token = String(data.token || "").trim();

      if (!userId) return res.status(400).send("missing user_id");
      if (!txid) return res.status(400).send("missing txid");
      if (!reward || reward <= 0) return res.status(400).send("invalid reward");
      if (token !== POSTBACK_TOKEN) return res.status(403).send("invalid token");

      const txRef = db.collection("ayetTransactions").doc(txid);
      const txSnap = await txRef.get();
      if (txSnap.exists) return res.status(200).send("ok (duplicate)");

      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const currentPoints = userSnap.exists ? (userSnap.data().points || 0) : 0;
        const newPoints = currentPoints + reward;

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
const FORTNITE_API_KEY = "73ffb01e-97df-46f7-b5ee-4023c5c020f5";

function safeStr(v) {
  return typeof v === "string" ? v : (v != null ? String(v) : "");
}

async function syncShopNow() {
  console.log("Fetching Fortnite shop...");

  const res = await fetch(SHOP_URL, {
    headers: { "Authorization": FORTNITE_API_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed: ${res.status} - ${body}`);
  }

  const json = await res.json();
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
  let ops = 0;
  let saved = 0;

  for (const entry of entries) {
    const items = [
      ...(Array.isArray(entry.brItems) ? entry.brItems : []),
      ...(Array.isArray(entry.tracks) ? entry.tracks : []),
      ...(Array.isArray(entry.instruments) ? entry.instruments : []),
      ...(Array.isArray(entry.cars) ? entry.cars : []),
      ...(Array.isArray(entry.legoKits) ? entry.legoKits : []),
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
        name: safeStr(it?.name || ""),
        type: safeStr(it?.type?.value || ""),
        rarity: safeStr(it?.rarity?.displayValue || it?.rarity?.value || ""),
        price: price,
        imageUrl: imageUrl,
        imageFull: safeStr(it?.images?.featured || it?.images?.icon || ""),
        videoUrl: safeStr(it?.showcaseVideos?.[0] || it?.video || ""),
        description: safeStr(it?.description || ""),
        sort: saved,
        updatedAt: now,
      });

      saved++;
      ops++;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
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

exports.forceFortniteShopSync = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      await syncShopNow();
      res.json({ ok: true, message: "Shop synced successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

exports.syncFortniteShop = onSchedule(
  { schedule: "5 20 * * *", timeZone: "America/Santo_Domingo", region: "us-central1" },
  async () => { await syncShopNow(); }
);

// =====================
// ADGEM POSTBACK (v2)
// ✅ AdGem envía {player_id} con guion bajo
// ✅ Sin verificación de "key" — AdGem no la envía
// ✅ Seguridad por anti-duplicado de txid
// =====================

exports.adgemPostback = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      const data = req.method === "POST" ? (req.body || {}) : (req.query || {});

      // ✅ AdGem envía "player_id" (con guion bajo) según sus macros
      const userId = String(data.player_id || data.playerid || "").trim();
      const reward = Math.round(Number(data.amount || 0));
      const txid   = String(data.transaction_id || "").trim();

      if (!userId) return res.status(400).send("missing player_id");
      if (!txid)   return res.status(400).send("missing transaction_id");
      if (!reward || reward <= 0) return res.status(400).send("invalid amount");

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
