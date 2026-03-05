// src/data/raffles.js
// Datos mock de sorteos + funciones utilitarias
// Reemplaza RAFFLES con getActiveRaffles() de firebase/raffles.js cuando conectes Firestore

export const RAFFLES = [
  {
    id: "raffle_amazon_50",
    title: "Amazon",
    value: "$50",
    brand: "amazon",
    cost: 800,
    participants: 1247,
    maxParticipants: 2000,
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    color: "#FF9900",
    colorDark: "#cc7a00",
    emoji: "📦",
    tag: "🔥 Popular",
    tagColor: "#f43f8c",
  },
  {
    id: "raffle_ps_25",
    title: "PlayStation",
    value: "$25",
    brand: "playstation",
    cost: 400,
    participants: 683,
    maxParticipants: 1000,
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    color: "#003087",
    colorDark: "#00194a",
    emoji: "🎮",
    tag: "⚡ Fácil de ganar",
    tagColor: "#8b5cf6",
  },
  {
    id: "raffle_gplay_10",
    title: "Google Play",
    value: "$10",
    brand: "google",
    cost: 150,
    participants: 312,
    maxParticipants: 500,
    endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    color: "#34A853",
    colorDark: "#1e6e32",
    emoji: "📱",
    tag: "⏳ Termina pronto",
    tagColor: "#f5c842",
  },
  {
    id: "raffle_netflix_15",
    title: "Netflix",
    value: "$15",
    brand: "netflix",
    cost: 250,
    participants: 521,
    maxParticipants: 800,
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    color: "#E50914",
    colorDark: "#8b0000",
    emoji: "🎬",
    tag: "🆕 Nuevo",
    tagColor: "#22d3ee",
  },
  {
    id: "raffle_steam_20",
    title: "Steam",
    value: "$20",
    brand: "steam",
    cost: 320,
    participants: 198,
    maxParticipants: 600,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    color: "#1b2838",
    colorDark: "#0e141b",
    emoji: "🕹️",
    tag: null,
  },
];

export function formatTimeLeft(endDate) {
  const diff = endDate - Date.now();
  if (diff <= 0) return "Terminado";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getWinChance(participants, maxParticipants) {
  const chance = (1 / Math.max(participants, 1)) * 100;
  return chance < 0.1 ? "<0.1" : chance.toFixed(1);
}
