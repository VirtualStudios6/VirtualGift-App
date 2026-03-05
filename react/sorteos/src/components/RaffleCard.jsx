import { formatTimeLeft, getWinChance } from "../data/raffles";
import CoinBadge from "./CoinBadge";
import "./RaffleCard.css";

export default function RaffleCard({ raffle, onSelect, style }) {
  const timeLeft = formatTimeLeft(raffle.endDate);
  const fillPercent = Math.round((raffle.participants / raffle.maxParticipants) * 100);
  const winChance = getWinChance(raffle.participants, raffle.maxParticipants);
  const isUrgent = raffle.endDate - Date.now() < 24 * 3600 * 1000;

  return (
    <article
      className="raffle-card animate-fade-up"
      style={style}
      onClick={() => onSelect(raffle)}
    >
      <div
        className="raffle-card__glow"
        style={{ background: raffle.color }}
      />

      <div className="raffle-card__header">
        <div
          className="raffle-card__icon-wrap"
          style={{
            background: `linear-gradient(135deg, ${raffle.color}33, ${raffle.colorDark}55)`,
            border: `1px solid ${raffle.color}44`,
          }}
        >
          <span className="raffle-card__emoji">{raffle.emoji}</span>
        </div>
        <div className="raffle-card__title-group">
          <p className="raffle-card__brand">{raffle.title}</p>
          <h3 className="raffle-card__value" style={{ color: raffle.color }}>
            Gift Card {raffle.value}
          </h3>
        </div>
        {raffle.tag && (
          <span
            className="raffle-card__tag"
            style={{
              color: raffle.tagColor,
              borderColor: `${raffle.tagColor}33`,
              background: `${raffle.tagColor}14`,
            }}
          >
            {raffle.tag}
          </span>
        )}
      </div>

      <div className="raffle-card__stats">
        <div className="raffle-card__stat">
          <span className="raffle-card__stat-label">Participantes</span>
          <span className="raffle-card__stat-value">{raffle.participants.toLocaleString()}</span>
        </div>
        <div className="raffle-card__stat-divider" />
        <div className="raffle-card__stat">
          <span className="raffle-card__stat-label">Tu chance</span>
          <span className="raffle-card__stat-value">{winChance}%</span>
        </div>
        <div className="raffle-card__stat-divider" />
        <div className="raffle-card__stat">
          <span className={`raffle-card__stat-label ${isUrgent ? "urgent" : ""}`}>Termina en</span>
          <span className={`raffle-card__stat-value ${isUrgent ? "urgent" : ""}`}>{timeLeft}</span>
        </div>
      </div>

      <div className="raffle-card__progress-wrap">
        <div className="raffle-card__progress-track">
          <div
            className="raffle-card__progress-fill"
            style={{
              width: `${fillPercent}%`,
              background: `linear-gradient(90deg, ${raffle.colorDark}, ${raffle.color})`,
            }}
          />
        </div>
        <span className="raffle-card__progress-label">{fillPercent}% lleno</span>
      </div>

      <div className="raffle-card__footer">
        <div className="raffle-card__cost">
          <span className="raffle-card__cost-label">Entrada</span>
          <CoinBadge amount={raffle.cost} size="md" />
        </div>
        <button
          className="raffle-card__btn"
          style={{ background: `linear-gradient(135deg, ${raffle.colorDark}, ${raffle.color})` }}
          onClick={(e) => { e.stopPropagation(); onSelect(raffle); }}
        >
          Participar
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </article>
  );
}
