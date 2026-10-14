function TypingIndicator() {
  return (
    <div className="chat-message-row assistant-row typing-indicator-row">
      <div className="chat-avatar assistant-avatar">🤖</div>
      <div className="chat-bubble assistant-bubble typing-bubble">
        <div className="typing-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <span className="typing-label">FixIt Assistant is thinking...</span>
      </div>
    </div>
  );
}

export default TypingIndicator;
