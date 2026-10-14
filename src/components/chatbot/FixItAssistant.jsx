import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useServices } from "../../hooks/useServices";
import { useBookings } from "../../hooks/useBookings";
import { useComplaints } from "../../hooks/useComplaints";
import ChatWindow from "./ChatWindow";
import { generateAssistantReply, getRoleQuickActions, detectLanguage, resetAssistantClientContext } from "./assistantBrain";
import { speakResponse, stopSpeech } from "./speechService";
import apiClient, { getAuthToken } from "../../api/apiClient";
import "./FixItAssistant.css";

const STORAGE_KEY = "fixit_chatbot_history";
const LANG_STORAGE_KEY = "fixit_chatbot_lang_prefs";
const VOICE_STORAGE_KEY = "fixit_chatbot_voice_prefs";

/**
 * Builds the initial greeting message tailored to user role, name, and language.
 */
function createInitialGreeting(role = "customer", userName = "there", lang = "en") {
  const isTamil = lang === "ta" || lang === "tanglish";

  let text = `Hello ${userName}! 👋 I'm **FixIt Assistant**, your smart local service guide. Describe any home repair problem (e.g. *"My AC is not cooling"* or *"Tap is leaking"*), ask for pricing, or check your bookings!`;
  let actions = [
    { label: "🔍 Find a Service", path: "/customer/services" },
    { label: "📅 Book a Service", path: "/customer/book" },
    { label: "📦 Track Booking", path: "/customer/booking-history" },
  ];

  if (role === "provider") {
    if (isTamil) {
      text = `வணக்கம் ${userName}! 🧰 நான் **FixIt Assistant**. உங்கள் சேவைகள், bookings மற்றும் வேலை நேரத்தை நிர்வகிக்க உங்களுக்கு உதவ முடியும்.`;
      actions = [
        { label: "📋 எனது Bookings", path: "/provider/dashboard" },
        { label: "🕒 Availability நேரம்", path: "/provider/availability" },
        { label: "🧰 Services மேலாண்மை", path: "/provider/services" },
      ];
    } else {
      text = `Hello ${userName}! 🧰 I'm **FixIt Assistant**. I can help you manage your services, bookings, and availability schedule.`;
      actions = [
        { label: "📋 My Bookings", path: "/provider/dashboard" },
        { label: "🕒 Set Availability", path: "/provider/availability" },
        { label: "🧰 Manage Services", path: "/provider/services" },
      ];
    }
  } else if (role === "admin") {
    if (isTamil) {
      text = `வணக்கம் ${userName}! 🛡️ நான் **FixIt Assistant**. Provider ஒப்புதல்கள், புகார்கள் மற்றும் தளத்தின் bookings-ஐ ஆய்வு செய்ய நான் உதவுகிறேன்.`;
      actions = [
        { label: "🛡️ Provider ஒப்புதல்கள்", path: "/admin/provider-approvals" },
        { label: "📢 புகார்கள் Console", path: "/admin/complaints" },
        { label: "📊 தளம் அறிக்கைகள்", path: "/admin/reports" },
      ];
    } else {
      text = `Hello ${userName}! 🛡️ I'm **FixIt Assistant**. I can help you inspect provider approvals, investigate open complaints, and review platform bookings.`;
      actions = [
        { label: "🛡️ Provider Approvals", path: "/admin/provider-approvals" },
        { label: "📢 Complaints Console", path: "/admin/complaints" },
        { label: "📊 Platform Reports", path: "/admin/reports" },
      ];
    }
  } else {
    // Customer
    if (isTamil) {
      text = `வணக்கம் ${userName}! 👋 நான் **FixIt Assistant**, உங்கள் ஸ்மார்ட் உள்ளூர் சேவை வழிகாட்டி. ஏசி ரிப்பேர், பிளம்பிங் போன்ற பிரச்னைகளை தெரிவிக்கலாம், விலை விவரங்களை அறியலாம், அல்லது உங்கள் booking-ஐ கண்காணிக்கலாம்!`;
      actions = [
        { label: "🔍 சேவை தேடு", path: "/customer/services" },
        { label: "📅 Service Book பண்ணு", path: "/customer/book" },
        { label: "📦 Booking கண்காணிக்க", path: "/customer/booking-history" },
      ];
    }
  }

  return {
    id: `initial-greeting-${Date.now()}`,
    sender: "assistant",
    text,
    actions,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Retrieve chat history strictly isolated for the given user ID.
 */
function loadUserConversation(userId, role, userName, lang = "en") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const historyArray = JSON.parse(raw);
      if (Array.isArray(historyArray)) {
        const userEntry = historyArray.find((item) => item && item.userId === userId);
        if (userEntry && Array.isArray(userEntry.messages) && userEntry.messages.length > 0) {
          return userEntry.messages;
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return [createInitialGreeting(role, userName, lang)];
}

/**
 * Save chat history strictly isolated for the given user ID.
 */
function saveUserConversation(userId, role, messages) {
  try {
    let historyArray = [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        historyArray = parsed;
      }
    }

    const entryIndex = historyArray.findIndex((item) => item && item.userId === userId);
    const newEntry = {
      userId,
      role,
      messages,
      updatedAt: Date.now(),
    };

    if (entryIndex >= 0) {
      historyArray[entryIndex] = newEntry;
    } else {
      historyArray.push(newEntry);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));
  } catch {
    // Ignore storage write errors
  }
}

function loadUserLanguage(userId) {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs && prefs[userId]) {
        return prefs[userId];
      }
    }
  } catch {
    // ignore
  }
  return "en";
}

function saveUserLanguage(userId, lang) {
  try {
    let prefs = {};
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw) {
      prefs = JSON.parse(raw) || {};
    }
    prefs[userId] = lang;
    localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function loadUserVoicePref(userId) {
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY);
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs && typeof prefs[userId] === "boolean") {
        return prefs[userId];
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function saveUserVoicePref(userId, isEnabled) {
  try {
    let prefs = {};
    const raw = localStorage.getItem(VOICE_STORAGE_KEY);
    if (raw) {
      prefs = JSON.parse(raw) || {};
    }
    prefs[userId] = isEnabled;
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function FixItAssistant() {
  const { user } = useAuth();
  const { services } = useServices();
  const { bookings } = useBookings();
  const { complaints } = useComplaints();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);

  // Derived user identifiers
  const currentUserId = user ? user.id || user.email || user.username || `${user.role}_${user.name}` : "guest";
  const role = user?.role || "customer";
  const userName = user?.name || "there";

  // Preferences per user
  const [currentLang, setCurrentLang] = useState(() => loadUserLanguage(currentUserId));
  const [detectedLang, setDetectedLang] = useState("en");
  const [autoReadAloud, setAutoReadAloud] = useState(() => loadUserVoicePref(currentUserId));

  // State holding ONLY current user's messages
  const [messages, setMessages] = useState(() =>
    loadUserConversation(currentUserId, role, userName, currentLang)
  );

  // Dynamic suggestions list
  const [suggestions, setSuggestions] = useState([
    "Find a plumber",
    "Book an electrician",
    "Track my provider",
    "Check my booking",
    "Payment status",
    "Need help",
  ]);

  // Switch conversation and preferences when authenticated user changes
  useEffect(() => {
    const userLang = loadUserLanguage(currentUserId);
    const userVoice = loadUserVoicePref(currentUserId);
    setCurrentLang(userLang);
    setAutoReadAloud(userVoice);

    const userMessages = loadUserConversation(currentUserId, role, userName, userLang);
    setMessages(userMessages);
  }, [currentUserId, role, userName]);

  // Sync current user's messages to localStorage whenever messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      saveUserConversation(currentUserId, role, messages);
    }
  }, [messages, currentUserId, role]);

  // Fetch backend history on initial mount if token exists
  useEffect(() => {
    const token = getAuthToken();
    if (token && user) {
      apiClient
        .get("/chatbot/history")
        .then((res) => {
          let list = res?.data?.messages;
          if (typeof list === "string") {
            try {
              list = JSON.parse(list);
            } catch (_) {
              list = [];
            }
          }
          if (Array.isArray(list) && list.length > 0) {
            setMessages(list);
            saveUserConversation(currentUserId, role, list);
          }
        })
        .catch(() => {
          // Gracefully continue using local storage
        });
    }
  }, [user, currentUserId, role]);

  // Quick action suggestions dynamically determined from role, language, and page context
  const quickActions = useMemo(
    () => getRoleQuickActions(role, currentLang, location.pathname),
    [role, currentLang, location.pathname]
  );

  // Change Language handler
  const handleSelectLang = useCallback(
    (newLang) => {
      setCurrentLang(newLang);
      saveUserLanguage(currentUserId, newLang);
    },
    [currentUserId]
  );

  // Toggle Auto-Read Aloud handler
  const handleToggleAutoRead = useCallback(() => {
    setAutoReadAloud((prev) => {
      const next = !prev;
      saveUserVoicePref(currentUserId, next);
      if (!next) {
        stopSpeech();
        setActiveSpeakingId(null);
      }
      return next;
    });
  }, [currentUserId]);

  // Speaker button click handler for individual message
  const handleToggleSpeak = useCallback(
    (msg, index) => {
      const id = msg.id || index;
      if (activeSpeakingId === id) {
        stopSpeech();
        setActiveSpeakingId(null);
        return;
      }

      stopSpeech();
      setActiveSpeakingId(id);

      // Detect language of the message text for accurate TTS voice
      const msgLang = detectLanguage(msg.text);
      const voiceLang = msgLang === "ta" || msgLang === "tanglish" ? "ta" : currentLang;

      speakResponse(
        msg.text,
        voiceLang,
        () => setActiveSpeakingId(id),
        () => setActiveSpeakingId(null)
      );
    },
    [activeSpeakingId, currentLang]
  );

  // Stop speech when assistant window is closed
  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
      setActiveSpeakingId(null);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(
    async (text, action = null, payload = null) => {
      const trimmed = text ? text.trim() : "";
      if (!trimmed && !action) return;

      setErrorMessage(null);

      // Auto-detect language if current language was not manually fixed
      const detected = detectLanguage(trimmed);
      setDetectedLang(detected);
      let effectiveLang = currentLang;
      if (detected === "ta" || detected === "tanglish") {
        effectiveLang = detected;
      }

      let updatedPayload = payload ? { ...payload } : {};

      // If user asks for nearby providers, capture browser geolocation if available
      const isNearbyQuery = /\b(near\s*me|nearby|enoda\s+location|location\s*ku|en\s*pakkathula|enga\s*kitta)\b/i.test(trimmed) ||
        trimmed.includes('அருகில்') ||
        trimmed.includes('அருகிலுள்ள');

      const isTestEnv =
        (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "test") ||
        (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test") ||
        typeof vi !== "undefined" ||
        (typeof window !== "undefined" && (Boolean(window.__VITEST__) || Boolean(window.vi)));

      if (!isTestEnv && isNearbyQuery && typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const coords = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 3000);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timer);
                resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              },
              (err) => {
                clearTimeout(timer);
                resolve({ permissionDenied: err.code === 1 });
              },
              { timeout: 3000, enableHighAccuracy: false }
            );
          });

          if (coords) {
            if (coords.latitude != null) {
              updatedPayload.coordinates = coords;
            } else if (coords.permissionDenied) {
              updatedPayload.locationPermissionDenied = true;
            }
          }
        } catch {
          // Continue gracefully
        }
      }

      const userDisplay = trimmed || (action ? `[Action: ${action.replace(/_/g, " ")}]` : "");
      const userMsg = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: userDisplay,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => {
        const next = [...prev, userMsg];
        saveUserConversation(currentUserId, role, next);
        return next;
      });

      setIsTyping(true);

      // If in browser and not in Vitest unit test, communicate with real backend
      if (typeof window !== "undefined" && !isTestEnv) {
        try {
          const res = await apiClient.post("/chatbot/message", {
            message: trimmed,
            action,
            payload: updatedPayload,
            coordinates: updatedPayload.coordinates,
            sessionId: currentUserId
          });

          const botData = res.data?.assistantMessage || res.data;
          if (botData) {
            const assistantMsg = {
              id: botData.id || `asst-${Date.now()}`,
              sender: "assistant",
              text: botData.text,
              card: botData.card,
              actions: botData.actions,
              suggestions: botData.suggestions,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };

            setMessages((prev) => {
              const next = [...prev, assistantMsg];
              saveUserConversation(currentUserId, role, next);
              return next;
            });

            if (botData.suggestions && Array.isArray(botData.suggestions)) {
              setSuggestions(botData.suggestions);
            }

            setIsTyping(false);

            if (autoReadAloud) {
              const replyLang = detectLanguage(assistantMsg.text) === "ta" ? "ta" : effectiveLang;
              speakResponse(
                assistantMsg.text,
                replyLang,
                () => setActiveSpeakingId(assistantMsg.id),
                () => setActiveSpeakingId(null)
              );
            }

            if (!isOpen) {
              setHasUnread(true);
            }
            return;
          }
        } catch (backendErr) {
          console.warn("[FixItAssistant] Backend API request failed, gracefully falling back to local brain:", backendErr.message);
          // Fall through to local brain seamlessly
        }
      }

      // Local / Offline / Unit Test Brain Fallback
      setTimeout(() => {
        try {
          const reply = generateAssistantReply({
            message: trimmed || action,
            user,
            role,
            locationPath: location.pathname,
            services,
            bookings,
            complaints,
            applications: [],
            preferredLang: effectiveLang,
          });

          const asstId = `asst-${Date.now()}`;
          const assistantMsg = {
            id: asstId,
            sender: "assistant",
            text: reply.text,
            card: reply.card,
            actions: reply.actions,
            suggestions: reply.suggestions,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };

          setMessages((prev) => {
            const next = [...prev, assistantMsg];
            saveUserConversation(currentUserId, role, next);
            return next;
          });

          if (reply.suggestions && Array.isArray(reply.suggestions)) {
            setSuggestions(reply.suggestions);
          }

          setIsTyping(false);

          if (autoReadAloud) {
            const replyLang = detectLanguage(reply.text) === "ta" ? "ta" : effectiveLang;
            speakResponse(
              reply.text,
              replyLang,
              () => setActiveSpeakingId(asstId),
              () => setActiveSpeakingId(null)
            );
          }

          if (!isOpen) {
            setHasUnread(true);
          }
        } catch (localErr) {
          setIsTyping(false);
          setErrorMessage("Sorry, I couldn't complete that request.");
          setLastFailedMessage({ text, action, payload });
        }
      }, 400);
    },
    [user, role, currentUserId, currentLang, autoReadAloud, location.pathname, services, bookings, complaints, isOpen]
  );

  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      const { text, action, payload } = lastFailedMessage;
      setErrorMessage(null);
      setLastFailedMessage(null);
      handleSendMessage(text, action, payload);
    }
  }, [lastFailedMessage, handleSendMessage]);

  const handleCardAction = useCallback(
    (actionObj) => {
      if (actionObj.path) {
        navigate(actionObj.path, { state: actionObj.state });
        setIsOpen(false);
      } else if (actionObj.action) {
        handleSendMessage("", actionObj.action, actionObj.payload);
      }
    },
    [navigate, handleSendMessage]
  );

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  const handleClearChat = () => {
    stopSpeech();
    setActiveSpeakingId(null);
    resetAssistantClientContext();
    const freshGreeting = [createInitialGreeting(role, userName, currentLang)];
    setMessages(freshGreeting);
    saveUserConversation(currentUserId, role, freshGreeting);

    apiClient.delete("/chatbot/history", { data: { sessionId: currentUserId } }).catch(() => {});
  };

  return (
    <div className="fixit-assistant-container" aria-label="FixIt Assistant Chatbot">
      {/* Floating launcher button */}
      <button
        type="button"
        className={`fixit-assistant-launcher ${isOpen ? "open" : ""}`}
        onClick={handleToggle}
        aria-label={isOpen ? "Close FixIt Assistant" : "FixIt Assistant"}
        title="FixIt Assistant"
      >
        <span className="launcher-icon">{isOpen ? "✕" : "🤖"}</span>
        {hasUnread && !isOpen && (
          <span className="launcher-unread-badge" aria-label="New message available" />
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
          errorMessage={errorMessage}
          onRetry={handleRetry}
          quickActions={quickActions}
          suggestions={suggestions}
          currentLang={currentLang}
          detectedLang={detectedLang}
          onSelectLang={handleSelectLang}
          autoReadAloud={autoReadAloud}
          onToggleAutoRead={handleToggleAutoRead}
          activeSpeakingId={activeSpeakingId}
          onToggleSpeak={handleToggleSpeak}
          onSendMessage={handleSendMessage}
          onCardAction={handleCardAction}
          onClearChat={handleClearChat}
          onMinimize={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default FixItAssistant;
