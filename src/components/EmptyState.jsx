/**
 * Reusable empty state — replaces ad-hoc "No X yet." <p> tags scattered
 * across list pages with something that actually looks intentional
 * (icon + title + message + optional action), while staying tiny and
 * dependency-free like the rest of this component set.
 *
 * Usage:
 *   <EmptyState icon="📅" title="No bookings yet"
 *     message="Once you book a service, it'll show up here."
 *     actionLabel="Browse Services" onAction={() => navigate('/customer/services')} />
 */
function EmptyState({ icon = "📭", title = "Nothing here yet", message, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
