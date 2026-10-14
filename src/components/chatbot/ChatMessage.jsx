import React from "react";
import { useNavigate } from "react-router-dom";
import { DynamicChatCard } from "./ChatCards";

function ChatMessage({
  message,
  onActionClick,
  isSpeaking = false,
  onToggleSpeak,
}) {
  const navigate = useNavigate();
  const isAssistant = message.sender === "assistant";

  const handleAction = (action) => {
    if (action.path) {
      navigate(action.path, { state: action.state });
    }
    if (onActionClick) {
      onActionClick(action);
    }
  };

  // Basic markdown parser for bold, italic, bullet points, numbers, and line breaks
  const formatText = (text) => {
    if (!text) return null;
    const lines = text.split("\n");

    return lines.map((line, idx) => {
      // Process bold **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={pIdx}>{part.slice(1, -1)}</em>;
        }
        return part;
      });

      if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
        return (
          <div key={idx} className="chat-bullet-line">
            <span className="chat-bullet-dot">•</span>
            <span>{formattedLine}</span>
          </div>
        );
      }

      // Step by step numbered emoji or steps (e.g. 1️⃣)
      if (/^[1-9]️⃣/.test(line.trim())) {
        return (
          <div key={idx} className="chat-step-line">
            {formattedLine}
          </div>
        );
      }

      return (
        <p key={idx} className="chat-text-line">
          {formattedLine}
        </p>
      );
    });
  };

  return (
    <div className={`chat-message-row ${isAssistant ? "assistant-row" : "user-row"}`}>
      {isAssistant && (
        <div className="chat-avatar assistant-avatar" title="FixIt Assistant">
          <span className="avatar-icon">🤖</span>
        </div>
      )}

      <div className={`chat-bubble ${isAssistant ? "assistant-bubble" : "user-bubble"}`}>
        {message.text && (
          <div className="chat-message-content">{formatText(message.text)}</div>
        )}

        {/* Structured Smart Card if present */}
        {message.card && (
          <div className="chat-card-container">
            <DynamicChatCard card={message.card} onAction={handleAction} />
          </div>
        )}

        {/* Action Buttons if present */}
        {message.actions && Array.isArray(message.actions) && message.actions.length > 0 && (
          <div className="chat-actions-container">
            {message.actions.map((act, i) => (
              <button
                key={i}
                type="button"
                className={`chat-action-btn ${act.variant ? `chat-action-${act.variant}` : ""}`}
                onClick={() => handleAction(act)}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        <div className="chat-bubble-footer">
          {isAssistant && onToggleSpeak && (
            <button
              type="button"
              className={`chat-speaker-btn ${isSpeaking ? "speaking" : ""}`}
              onClick={() => onToggleSpeak(message)}
              title={isSpeaking ? "Stop voice" : "Read response aloud"}
              aria-label={isSpeaking ? "Stop speaking response" : "Read response aloud"}
            >
              {isSpeaking ? "⏹️" : "🔊"}
            </button>
          )}

          <span className="chat-timestamp">
            {message.time || message.createdAt ? (
              message.time || new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            ) : (
              new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            )}
          </span>
        </div>
      </div>

      {!isAssistant && (
        <div className="chat-avatar user-avatar" title="You">
          <span className="avatar-icon">👤</span>
        </div>
      )}
    </div>
  );
}

export default ChatMessage;
