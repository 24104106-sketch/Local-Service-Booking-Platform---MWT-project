function QuickActions({ actions = [], onSelect }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="chat-quick-actions-wrapper">
      <div className="chat-quick-actions-track">
        {actions.map((act, i) => (
          <button
            key={i}
            type="button"
            className="chat-quick-pill"
            onClick={() => onSelect(act.prompt)}
          >
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
