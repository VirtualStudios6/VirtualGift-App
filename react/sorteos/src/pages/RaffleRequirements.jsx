import { useState } from "react";
import "./RaffleRequirements.css";

const REQUIREMENTS = [
  {
    id: "req_follow",
    icon: "📲",
    title: "Seguir en Instagram",
    description: "@VirtualGift.app — Activa notificaciones",
    cta: "Seguir ahora",
    link: "https://instagram.com/",
    points: 50,
  },
  {
    id: "req_ad",
    icon: "📺",
    title: "Ver anuncio",
    description: "Mira el video completo (30 seg)",
    cta: "Ver anuncio",
    link: null,
    points: 30,
    waitSeconds: 5,
  },
  {
    id: "req_share",
    icon: "🔗",
    title: "Compartir sorteo",
    description: "Comparte en tus redes sociales",
    cta: "Compartir",
    link: null,
    points: 20,
  },
];

function formatTimeLeft(endDate) {
  const diff = endDate - Date.now();
  if (diff <= 0) return "Pronto";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

export default function RaffleRequirements({ raffle, onBack }) {
  const [completed, setCompleted] = useState({});
  const [activeAd, setActiveAd] = useState(null);
  const [adCountdown, setAdCountdown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const allDone = REQUIREMENTS.every((r) => completed[r.id]);
  const doneCount = Object.values(completed).filter(Boolean).length;

  const handleReq = (req) => {
    if (completed[req.id]) return;

    if (req.waitSeconds) {
      setActiveAd(req.id);
      let t = req.waitSeconds;
      setAdCountdown(t);
      const iv = setInterval(() => {
        t--;
        setAdCountdown(t);
        if (t <= 0) {
          clearInterval(iv);
          setActiveAd(null);
          setCompleted((c) => ({ ...c, [req.id]: true }));
        }
      }, 1000);
      return;
    }

    if (req.link) window.open(req.link, "_blank");
    setTimeout(() => {
      setCompleted((c) => ({ ...c, [req.id]: true }));
    }, 800);
  };

  if (showSuccess) {
    return <SuccessScreen raffle={raffle} />;
  }

  return (
    <div className="req-page">
      <button className="req-page__back" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Volver
      </button>

      <div className="req-page__scroll">
        <div className="req-page__header">
          <div
            className="req-page__raffle-pill"
            style={{ borderColor: `${raffle.color}44`, background: `${raffle.color}14` }}
          >
            <span>{raffle.emoji}</span>
            <span style={{ color: raffle.color }}>{raffle.title} {raffle.value}</span>
          </div>
          <h1 className="req-page__title">Completa los requisitos</h1>
          <p className="req-page__sub">Valida tu entrada completando las siguientes acciones</p>
        </div>

        <div className="req-page__progress-section">
          <div className="req-page__progress-row">
            <span className="req-page__progress-label">{doneCount} de {REQUIREMENTS.length} completados</span>
            <span className="req-page__progress-pct">{Math.round((doneCount / REQUIREMENTS.length) * 100)}%</span>
          </div>
          <div className="req-page__progress-track">
            <div
              className="req-page__progress-fill"
              style={{ width: `${(doneCount / REQUIREMENTS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="req-page__list">
          {REQUIREMENTS.map((req, i) => {
            const isDone = !!completed[req.id];
            const isActive = activeAd === req.id;
            return (
              <div
                key={req.id}
                className={`req-card animate-fade-up ${isDone ? "done" : ""}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="req-card__icon-wrap">
                  <span className="req-card__icon">{req.icon}</span>
                  {isDone && (
                    <div className="req-card__check">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="req-card__content">
                  <p className="req-card__title">{req.title}</p>
                  <p className="req-card__desc">{req.description}</p>
                  <span className="req-card__bonus">+{req.points} coins bonus</span>
                </div>
                <div className="req-card__action">
                  {isDone ? (
                    <span className="req-card__done-badge">✓ Listo</span>
                  ) : isActive ? (
                    <div className="req-card__countdown">
                      <span>{adCountdown}s</span>
                    </div>
                  ) : (
                    <button className="req-card__btn" onClick={() => handleReq(req)}>
                      {req.cta}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="req-page__skip-note">
          * Los requisitos son opcionales, pero te dan coins bonus 🎁
        </p>
      </div>

      <div className="req-page__cta">
        <button
          className={`req-page__btn ${allDone ? "ready" : ""}`}
          onClick={() => setShowSuccess(true)}
        >
          {allDone
            ? "🎉 Confirmar participación"
            : `Continuar sin completar todo (${doneCount}/${REQUIREMENTS.length})`}
        </button>
      </div>
    </div>
  );
}

function SuccessScreen({ raffle }) {
  return (
    <div className="success-screen">
      <div className="success-screen__content">
        <div className="success-screen__rings">
          <div className="success-ring r1" />
          <div className="success-ring r2" />
          <div className="success-ring r3" />
        </div>
        <div className="success-screen__trophy">🏆</div>
        <h1 className="success-screen__title">¡Estás dentro!</h1>
        <p className="success-screen__sub">Tu participación en el sorteo</p>
        <div
          className="success-screen__raffle-chip"
          style={{ borderColor: `${raffle.color}55`, background: `${raffle.color}14` }}
        >
          <span>{raffle.emoji}</span>
          <span style={{ color: raffle.color, fontWeight: 700 }}>{raffle.title} {raffle.value}</span>
        </div>
        <p className="success-screen__desc">
          Se te notificará si resultas ganador. ¡Buena suerte! 🎊
        </p>
        <div className="success-screen__stats">
          <div className="success-screen__stat">
            <span className="success-screen__stat-value">#1</span>
            <span className="success-screen__stat-label">Tu entrada</span>
          </div>
          <div className="success-screen__stat-div" />
          <div className="success-screen__stat">
            <span className="success-screen__stat-value">{formatTimeLeft(raffle.endDate)}</span>
            <span className="success-screen__stat-label">Para el sorteo</span>
          </div>
        </div>
        <button className="success-screen__btn" onClick={() => window.location.reload()}>
          Ver más sorteos
        </button>
      </div>
    </div>
  );
}
