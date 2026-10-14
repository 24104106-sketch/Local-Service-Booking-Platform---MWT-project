import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import TypingIndicator from "./TypingIndicator";
import { startVoiceRecognition, isSpeechRecognitionSupported } from "./speechService";

function ChatWindow({
  messages = [],
  isTyping = false,
  errorMessage = null,
  onRetry = null,
  quickActions = [],
  suggestions = [],
  currentLang = "en",
  detectedLang = "en",
  onSelectLang,
  autoReadAloud = false,
  onToggleAutoRead,
  activeSpeakingId = null,
  onToggleSpeak,
  onSendMessage,
  onCardAction,
  onClearChat,
  onMinimize,
  onClose,
}) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const activeRecognitionRef = useRef(null);

  const messagesStreamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isTamil = currentLang === "ta" || currentLang === "tanglish";

  // Check if conversation is in initial / empty state
  const isFreshConversation =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].sender === "assistant" && messages[0].id?.startsWith("initial-greeting"));

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  // Monitor scroll position to show/hide "Scroll to bottom" button
  const handleScroll = useCallback(() => {
    if (!messagesStreamRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesStreamRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    setShowScrollBottom(distanceFromBottom > 120);
  }, []);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clean up voice recognition on unmount
  useEffect(() => {
    return () => {
      if (activeRecognitionRef.current) {
        activeRecognitionRef.current.stop();
      }
    };
  }, []);

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    if (isListening && activeRecognitionRef.current) {
      activeRecognitionRef.current.stop();
      setIsListening(false);
    }

    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickSelect = (prompt) => {
    if (isTyping) return;
    if (isListening && activeRecognitionRef.current) {
      activeRecognitionRef.current.stop();
      setIsListening(false);
    }
    onSendMessage(prompt);
  };

  // Voice Input (Speech-to-Text) Toggle
  const handleToggleVoiceInput = () => {
    if (isListening) {
      activeRecognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceNotice("");

    if (!isSpeechRecognitionSupported()) {
      const msg = isTamil
        ? "தமிழ் voice input இந்த browser-ல் support ஆகாமல் இருக்கலாம். Message-ஐ type செய்து தொடரலாம்."
        : "Voice input isn't supported on this browser. You can type your message instead.";
      setVoiceNotice(msg);
      setTimeout(() => setVoiceNotice(""), 5000);
      return;
    }

    setIsListening(true);
    const recognitionHandle = startVoiceRecognition({
      lang: currentLang,
      onResult: (transcript) => {
        setInputText(transcript);
      },
      onError: (errMsg) => {
        setVoiceNotice(errMsg);
        setIsListening(false);
        setTimeout(() => setVoiceNotice(""), 5000);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    activeRecognitionRef.current = recognitionHandle;
  };

  // Welcome Screen Quick Actions
  const welcomeQuickActions = [
    { label: "🔍 Find a Service", prompt: "Find a Service" },
    { label: "👨‍🔧 Find a Provider", prompt: "Find a Provider" },
    { label: "📅 My Booking", prompt: "Check my booking" },
    { label: "📍 Track Provider", prompt: "Track my provider" },
    { label: "💳 Payment Status", prompt: "Payment status" },
    { label: "🆘 Get Support", prompt: "Need help" },
  ];

  // Dynamic Suggestion Chips
  const activeSuggestions = suggestions && suggestions.length > 0
    ? suggestions
    : [
        "Find a plumber",
        "Book an electrician",
        "Track my provider",
        "Check my booking",
        "Payment status",
        "Need help",
      ];

  return (
    <div className="chat-window-panel" role="region" aria-label="FixIt Assistant Chat Window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-avatar-badge">
            <span className="chat-avatar-symbol">🤖</span>
            <span className="chat-online-dot-mini" aria-label="Status: Online" />
          </div>
          <div className="chat-header-titles">
            <div className="chat-title-row">
              <h3>FixIt Assistant</h3>
              <span className="chat-status-pill">● Online</span>
              <span className="chat-lang-pill" title="Detected message language">
                {detectedLang === "ta" ? "தமிழ்" : detectedLang === "tanglish" ? "Tanglish" : "EN"}
              </span>
            </div>
            <span className="chat-status-text">
              {isTamil ? "உங்கள் ஸ்மார்ட் உள்ளூர் சேவை AI" : "Your smart service assistant"}
            </span>
          </div>
        </div>

        <div className="chat-header-actions">
          {/* Language Selector: [ EN | தமிழ் | Tanglish ] */}
          <div className="chat-lang-switcher" title="Change language" aria-label="Change language">
            <button
              type="button"
              className={`lang-btn ${currentLang === "en" ? "active" : ""}`}
              onClick={() => onSelectLang?.("en")}
              aria-label="Switch to English"
            >
              EN
            </button>
            <span className="lang-divider">|</span>
            <button
              type="button"
              className={`lang-btn ${currentLang === "ta" ? "active" : ""}`}
              onClick={() => onSelectLang?.("ta")}
              aria-label="Switch to Tamil"
            >
              தமிழ்
            </button>
            <span className="lang-divider">|</span>
            <button
              type="button"
              className={`lang-btn ${currentLang === "tanglish" ? "active" : ""}`}
              onClick={() => onSelectLang?.("tanglish")}
              aria-label="Switch to Tanglish"
            >
              Tanglish
            </button>
          </div>

          {/* Auto Read Aloud Toggle */}
          <button
            type="button"
            className={`chat-header-btn ${autoReadAloud ? "voice-active" : ""}`}
            onClick={onToggleAutoRead}
            title={autoReadAloud ? "Voice Read Aloud: ON" : "Voice Read Aloud: OFF"}
            aria-label="Toggle voice auto read aloud"
          >
            {autoReadAloud ? "🔊" : "🔈"}
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            className="chat-header-btn"
            onClick={onClearChat}
            title="Clear Chat History"
            aria-label="Clear chat"
          >
            🗑️
          </button>

          {/* Minimize */}
          <button
            type="button"
            className="chat-header-btn"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize"
          >
            —
          </button>

          {/* Close */}
          <button
            type="button"
            className="chat-header-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Voice Notification Banner */}
      {voiceNotice && (
        <div className="chat-voice-notice" role="alert">
          <span>ℹ️ {voiceNotice}</span>
          <button type="button" onClick={() => setVoiceNotice("")} aria-label="Dismiss voice notice">
            ✕
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div
        className="chat-messages-stream"
        ref={messagesStreamRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        {/* Welcome Screen Hero (when starting fresh) */}
        {isFreshConversation && (
          <div className="chat-welcome-hero">
            <div className="welcome-avatar-halo">
              <span className="welcome-avatar-icon">🤖</span>
            </div>
            <h4 className="welcome-title">Hi! I'm FixIt Assistant</h4>
            <p className="welcome-subtitle">
              I can help you find services, choose providers, check bookings, track your provider, and more.
            </p>

            <div className="welcome-grid-actions">
              {welcomeQuickActions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="welcome-card-btn"
                  onClick={() => handleQuickSelect(item.prompt)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage
            key={msg.id || index}
            message={msg}
            onActionClick={onCardAction || onClose}
            isSpeaking={activeSpeakingId === (msg.id || index)}
            onToggleSpeak={() => onToggleSpeak?.(msg, index)}
          />
        ))}

        {isTyping && <TypingIndicator />}

        {/* Friendly Error State */}
        {errorMessage && (
          <div className="chat-error-banner" role="alert">
            <span className="chat-error-icon">⚠️</span>
            <div className="chat-error-content">
              <p className="chat-error-msg">Sorry, I couldn't complete that request.</p>
              {onRetry && (
                <button type="button" className="chat-retry-btn" onClick={onRetry}>
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Floating Button */}
      {showScrollBottom && (
        <button
          type="button"
          className="chat-scroll-bottom-btn"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to latest messages"
        >
          ↓ Latest
        </button>
      )}

      {/* Dynamic Suggestion Chips */}
      <div className="chat-suggestions-bar" aria-label="Quick suggestions">
        <div className="chat-suggestions-scroll">
          {activeSuggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              className="chat-suggestion-chip"
              onClick={() => handleQuickSelect(sug)}
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Role-based quick actions if available */}
      {quickActions && quickActions.length > 0 && (
        <QuickActions actions={quickActions} onSelect={handleQuickSelect} />
      )}

      {/* Active Voice Listening Status Indicator */}
      {isListening && (
        <div className="chat-listening-indicator" role="status">
          <span className="listening-pulse-dot" />
          <span className="listening-state-text">
            {isTamil ? "🎤 கேட்கிறது... பேசுங்கள் (Listening...)" : "🎤 Listening... Speak now"}
          </span>
        </div>
      )}

      {/* Input Box with Voice Input */}
      <form onSubmit={handleSubmit} className="chat-input-area" aria-label="Send message to assistant">
        {/* Microphone Button 🎙️ */}
        <button
          type="button"
          className={`chat-mic-btn ${isListening ? "listening" : ""}`}
          onClick={handleToggleVoiceInput}
          title={isListening ? "Listening... Click to stop" : "Voice input"}
          aria-label="Voice input"
        >
          {isListening ? "🔴" : "🎙️"}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? isTamil
                ? "பேசுங்கள்... கேட்கிறது..."
                : "Listening... Speak now..."
              : isTamil
              ? "உங்கள் பிரச்னை அல்லது கேள்வியை பதிவிடவும்..."
              : "Type your problem, service or question..."
          }
          disabled={isTyping}
          className={`chat-input-field ${isListening ? "listening-input" : ""}`}
          aria-label="Chat message input"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isTyping}
          className="chat-send-btn"
          aria-label="Send message"
          title="Send message"
        >
          ➤
        </button>
      </form>

      <div className="chat-footer-badge">
        <span>
          ⚡ FixIt Local AI • {isTamil ? "தமிழ் & English Voice Assistant" : "English & தமிழ் Voice Assistant"}
        </span>
      </div>
    </div>
  );
}

export default ChatWindow;
