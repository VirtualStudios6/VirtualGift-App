import { useState } from "react";
import CoinBadge from "../components/CoinBadge";
import { getWinChance, formatTimeLeft } from "../data/raffles";
import "./RaffleConfirm.css";

export default function RaffleConfirm({ raffle, user, onConfirm, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const canAfford = user.coins >= raffle.cost;
  const remaining = user.coins - raffle.cost;
  const winChance = getWinChance(raffle.participants + 1, raffle.maxParticipants);

  const handleConfirm = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    setError(null);

    try {
      const uid = user.uid;
      const db = window.db;

      // 1. Verifica que no haya entrado ya
      const existing = await db
        .collection("raffleParticipants")
        .where("raffleId", "==", raffle.id)
        .where("userId", "==", uid)
        .get();

      if (!existing.empty) {
        throw new Error("Ya estás participando en este sorteo.");
      }

      // 2. Lee coins actuales del usuario directo de Firestore (fuente de verdad)
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};

      const currentCoins =
        typeof userData.coins === "number" ? userData.coins : 0;

      if (currentCoins < raffle.cost) {
        throw new Error("No tienes suficientes coins.");
      }

      const newCoins = currentCoins - raffle.cost;

      // 3. Descuenta coins del usuario
      await userRef.update({
        coins: newCoins,
      });

      // 4. Registra en pointsHistory
      await userRef.update({
        pointsHistory: window.firebase.firestore.FieldValue.arrayUnion({
          amount: -raffle.cost,
          type: "raffle_entry",
          raffleId: raffle.id,
          raffleTitle: `${raffle.title} ${raffle.value}`,
          date: new Date().toISOString(),
        }),
      });

      // 5. Incrementa participantes del sorteo
      const raffleRef = db.collection("raffles").doc(raffle.id);
      await raffleRef.update({
        participants: window.firebase.firestore.FieldValue.increment(1),
      });

      // 6. Crea registro de participación
      await db.collection("raffleParticipants").add({
        raffleId: raffle.id,
        userId: uid,
        enteredAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        requirementsCompleted: false,
      });

      // 7. Pasa los coins actualizados al App para que actualice el estado
      onConfirm(newCoins);

    } catch (err) {
      console.error("Error al participar:", err);
      setError(err.message || "Ocurrió un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="confirm-page">
      <button className="confirm-page__back" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Volver
      </button>

      <div className="confirm-page__scroll">
        <div
          className="confirm-page__hero"
          style={{
            background: `linear-gradient(145deg, ${raffle.colorDark}cc, ${raffle.color}55)`,
            borderColor: `${raffle.color}44`,
          }}
        >
          <div className="confirm-page__hero-glow" style={{ background: raffle.color }} />
          <span className="confirm-page__hero-emoji">{raffle.emoji}</span>
          <div>
            <p className="confirm-page__hero-brand">{raffle.title} Gift Card</p>
            <h2 className="confirm-page__hero-value" style={{ color: raffle.color }}>
              {raffle.value}
            </h2>
          </div>
          {raffle.tag && (
            <span
              className="confirm-page__hero-tag"
              style={{
                color: raffle.tagColor,
                borderColor: `${raffle.tagColor}44`,
                background: `${raffle.tagColor}18`,
              }}
            >
              {raffle.tag}
            </span>
          )}
        </div>

        <h1 className="confirm-page__title">Confirmar participación</h1>
        <p className="confirm-page__sub">Revisa los detalles antes de gastar tus coins</p>

        <div className="confirm-page__panel">
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Sorteo</span>
            <span className="confirm-page__row-value">{raffle.title} {raffle.value}</span>
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Costo de entrada</span>
            <CoinBadge amount={raffle.cost} size="md" />
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Tu balance actual</span>
            <CoinBadge amount={user.coins} size="md" />
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Balance restante</span>
            <span className={`confirm-page__remaining ${canAfford ? "" : "negative"}`}>
              <span className="coin-icon">⬡</span>
              {remaining.toLocaleString()}
            </span>
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Participantes actuales</span>
            <span className="confirm-page__row-value">{raffle.participants.toLocaleString()}</span>
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Tu probabilidad de ganar</span>
            <span className="confirm-page__chance">{winChance}%</span>
          </div>
          <div className="confirm-page__divider" />
          <div className="confirm-page__row">
            <span className="confirm-page__row-label">Sorteo termina en</span>
            <span className="confirm-page__row-value">{formatTimeLeft(raffle.endDate)}</span>
          </div>
        </div>

        {!canAfford && (
          <div className="confirm-page__warning">
            <span>⚠️</span>
            <p>
              No tienes suficientes coins. Necesitas{" "}
              <strong>{(raffle.cost - user.coins).toLocaleString()}</strong> coins más.
            </p>
          </div>
        )}

        {error && (
          <div className="confirm-page__warning">
            <span>❌</span>
            <p>{error}</p>
          </div>
        )}

        {canAfford && !error && (
          <div className="confirm-page__info">
            <span>ℹ️</span>
            <p>Solo puedes tener <strong>1 entrada por sorteo</strong>. Los coins se descuentan al confirmar.</p>
          </div>
        )}
      </div>

      <div className="confirm-page__cta">
        <button
          className={`confirm-page__btn ${!canAfford ? "disabled" : ""} ${loading ? "loading" : ""}`}
          onClick={handleConfirm}
          disabled={!canAfford || loading}
          style={canAfford ? { background: `linear-gradient(135deg, ${raffle.colorDark}, ${raffle.color})` } : {}}
        >
          {loading ? (
            <>
              <span className="confirm-page__spinner" />
              Procesando…
            </>
          ) : (
            <>
              Participar en el sorteo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
        <p className="confirm-page__btn-note">
          Se descontarán <CoinBadge amount={raffle.cost} size="sm" /> de tu cuenta
        </p>
      </div>
    </div>
  );
}
