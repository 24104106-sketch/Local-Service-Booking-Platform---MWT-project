// Small icon-only toggle button — ♥ filled when active, ♡ outline when not.
// Stops propagation so it can sit inside a clickable card without also
// triggering the card's own onClick (e.g. "view details" navigation).
function FavoriteButton({ active, onToggle, size = 34, title }) {
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={title || (active ? "Remove from favorites" : "Add to favorites")}
      aria-label={title || (active ? "Remove from favorites" : "Add to favorites")}
      style={{
        width: size,
        height: size,
        color: active ? "var(--red)" : "var(--muted)",
        borderColor: active ? "var(--red)" : "var(--border-strong)",
        background: active ? "var(--red-bg)" : "var(--surface)",
        flexShrink: 0,
      }}
    >
      {active ? "♥" : "♡"}
    </button>
  );
}

export default FavoriteButton;
