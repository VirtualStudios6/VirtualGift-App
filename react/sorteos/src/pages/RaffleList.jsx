import { useState } from "react";
import { RAFFLES } from "../data/raffles";
import RaffleCard from "../components/RaffleCard";
import CoinBadge from "../components/CoinBadge";
import "./RaffleList.css";

const FILTERS = ["Todos", "Popular", "Precio bajo", "Termina pronto"];

export default function RaffleList({ user, onSelect }) {
  const [activeFilter, setActiveFilter] = useState("Todos");

  const filtered = RAFFLES.filter((r) => {
    if (activeFilter === "Popular") return r.tag?.includes("Popular");
    if (activeFilter === "Precio bajo") return r.cost <= 250;
    if (activeFilter === "Termina pronto") return r.endDate - Date.now() < 24 * 3600 * 1000 * 2;
    return true;
  });

  return (
    <div className="raffle-list">
      <div className="raffle-list__noise" />

      <header className="raffle-list__header">
        <div className="raffle-list__header-top">
          <div>
            <p className="raffle-list__greeting">Hola, {user.name} 👋</p>
            <h1 className="raffle-list__title">Sorteos</h1>
          </div>
          <div className="raffle-list__user-bal">
            <div className="raffle-list__avatar">{user.avatar}</div>
            <CoinBadge amount={user.coins} size="md" />
          </div>
        </div>

        <div className="raffle-list__banner">
          <div className="raffle-list__banner-pulse" />
          <div className="raffle-list__banner-content">
            <span className="raffle-list__banner-icon">🎁</span>
            <div>
              <p className="raffle-list__banner-title">Gana gift cards reales</p>
              <p className="raffle-list__banner-sub">Usa tus coins para entrar a sorteos exclusivos</p>
            </div>
          </div>
          <div className="raffle-list__banner-chips">
            <span>🏆 {RAFFLES.length} activos</span>
            <span>📅 Diarios</span>
          </div>
        </div>
      </header>

      <div className="raffle-list__filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`raffle-list__filter-btn ${activeFilter === f ? "active" : ""}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="raffle-list__count">
        <span>{filtered.length} sorteo{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="raffle-list__cards">
        {filtered.length === 0 ? (
          <div className="raffle-list__empty">
            <span>😔</span>
            <p>No hay sorteos con ese filtro</p>
          </div>
        ) : (
          filtered.map((raffle, i) => (
            <RaffleCard
              key={raffle.id}
              raffle={raffle}
              onSelect={onSelect}
              style={{ animationDelay: `${i * 0.07}s` }}
            />
          ))
        )}
      </div>

      <div style={{ height: "32px" }} />
    </div>
  );
}
