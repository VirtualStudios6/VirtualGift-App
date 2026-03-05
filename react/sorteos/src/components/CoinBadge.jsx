import "./CoinBadge.css";

export default function CoinBadge({ amount, size = "md", dim = false }) {
  return (
    <span className={`coin-badge coin-badge--${size} ${dim ? "coin-badge--dim" : ""}`}>
      <span className="coin-badge__icon">⬡</span>
      <span className="coin-badge__amount">{amount.toLocaleString()}</span>
    </span>
  );
}
