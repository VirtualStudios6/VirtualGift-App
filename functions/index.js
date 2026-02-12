const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * AYET POSTBACK (Callback URL)
 *
 * Ayet llamará esta URL cuando un usuario complete una oferta.
 *
 * IMPORTANTE:
 * - Acepta GET y POST
 * - Valida un token secreto para evitar fraude
 *
 * Ejemplo:
 * https://us-central1-TU_PROYECTO.cloudfunctions.net/ayetPostback?user_id=XXX&reward=1000&txid=abc&token=TU_TOKEN
 */

// 🔐 Token secreto (debe coincidir con el que pusiste en Ayet)
const POSTBACK_TOKEN = "VG_AYET_2026_4093228_SUPERSECRETO";

/** Helper: convierte a número seguro */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

exports.ayetPostback = functions.https.onRequest(async (req, res) => {
  try {
    // CORS básico (por si pruebas desde navegador)
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    const data = req.method === "POST" ? (req.body || {}) : (req.query || {});

    // Ayet suele enviar user_id, reward, transaction_id (o txid)
    const userId = String(data.user_id || data.userid || data.subid || "")
      .trim();

    const rewardRaw = data.reward || data.amount || data.payout || 0;
    const reward = Math.round(toNumber(rewardRaw)); // VirtualCoins a sumar

    const txid = String(data.transaction_id || data.txid || data.click_id || "")
      .trim();

    const token = String(data.token || "").trim();

    // ✅ Validaciones mínimas
    if (!userId) return res.status(400).send("missing user_id");
    if (!txid) return res.status(400).send("missing txid");
    if (!reward || reward <= 0) return res.status(400).send("invalid reward");

    // ✅ Token anti-fraude
    if (token !== POSTBACK_TOKEN) {
      return res.status(403).send("invalid token");
    }

    // ✅ Anti-duplicado: si llega 2 veces el mismo txid, no sumar doble
    const txRef = db.collection("ayetTransactions").doc(txid);
    const txSnap = await txRef.get();
    if (txSnap.exists) {
      return res.status(200).send("ok (duplicate)");
    }

    // ✅ Sumar coins al usuario
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);

      const currentPoints = userSnap.exists ? (userSnap.data().points || 0) : 0;
      const newPoints = Number(currentPoints) + reward;

      if (!userSnap.exists) {
        transaction.set(userRef, {points: newPoints}, {merge: true});
      } else {
        transaction.update(userRef, {points: newPoints});
      }

      // Guardar tx para evitar duplicado
      transaction.set(txRef, {
        userId: userId,
        reward: reward,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Historial
      const historyRef = db.collection("pointsHistory").doc();
      transaction.set(historyRef, {
        userId: userId,
        type: "ayet_offer",
        points: reward,
        txid: txid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).send("ok");
  } catch (error) {
    console.error(error);
    return res.status(500).send("error");
  }
});
