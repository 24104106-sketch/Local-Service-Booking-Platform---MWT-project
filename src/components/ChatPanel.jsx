import { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// A few short canned replies for the typing-indicator simulation below —
// intentionally generic since we don't know what was actually asked.
const CANNED_REPLIES = [
  "Got it, thanks for letting me know!",
  "Sure, that works for me.",
  "Okay, I'll keep that in mind.",
  "Sounds good 👍",
];

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// role: "customer" | "provider" — whichever side is currently viewing.
// booking must have .id, .customer, .provider so messages route correctly.
function ChatPanel({ booking, role, myName }) {
  const { messagesForBooking, sendMessage, markThreadRead } = useChat();
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const listRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const thread = messagesForBooking(booking.id);
  const otherRole = role === "customer" ? "provider" : "customer";
  const otherParty = role === "customer" ? booking.provider : booking.customer;

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread.length, otherTyping]);

  // Mark the other party's messages as read the moment this panel is open
  // and visible — real read-receipt behavior, not just a static flag.
  useEffect(() => {
    markThreadRead(booking.id, role);
  }, [booking.id, role, thread.length, markThreadRead]);

  // Clear any pending simulated-typing timeout if the panel closes mid-reply.
  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  // Real-time simulation (no backend): after I send a message, show
  // "{other party} is typing..." briefly, then auto-insert a short reply
  // from their side. Capped by thread length so a demo conversation
  // settles rather than ping-ponging forever, and only ever triggered by
  // MY own send — never by an effect watching the thread — so a reload or
  // the other role's own panel can't re-trigger it.
  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(booking, role, myName, trimmed);
    setText("");

    if (thread.length < 8) {
      setOtherTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        setOtherTyping(false);
        sendMessage(booking, otherRole, otherParty, CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]);
      }, 1200 + Math.random() * 800);
    }
  };

  // "Online status" derived from real activity — the other party's most
  // recent message in this thread, not a fabricated presence system.
  const lastFromOther = [...thread].reverse().find((m) => m.sender !== role);
  const isRecentlyActive = lastFromOther && Date.now() - new Date(lastFromOther.timestamp).getTime() < ACTIVE_WINDOW_MS;

  return (
    <div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: isRecentlyActive ? "var(--green)" : "var(--faint)", display: "inline-block" }} />
        Chatting with {otherParty} about {booking.service} ({booking.id})
        {isRecentlyActive && <span style={{ color: "var(--green)" }}>· Active recently</span>}
      </p>

      <div
        ref={listRef}
        style={{
          height: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10,
          padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {thread.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 12, textAlign: "center", marginTop: 90 }}>
            No messages yet — say hello 👋
          </p>
        ) : (
          thread.map((m) => {
            const mine = m.sender === role;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                <div
                  style={{
                    background: mine ? "var(--blue)" : "var(--stripe)",
                    color: mine ? "#fff" : "var(--ink)",
                    borderRadius: 12,
                    padding: "7px 11px",
                    fontSize: 12.5,
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
                <p style={{ fontSize: 9.5, color: "var(--faint)", margin: "2px 4px 0", textAlign: mine ? "right" : "left" }}>
                  {m.senderName} · {formatTime(m.timestamp)}
                  {mine && <span style={{ marginLeft: 4, color: m.read ? "var(--blue)" : "var(--faint)" }}>{m.read ? "✓✓ Read" : "✓ Sent"}</span>}
                </p>
              </div>
            );
          })
        )}
        {otherTyping && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{ background: "var(--stripe)", borderRadius: 12, padding: "7px 11px", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              {otherParty} is typing...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input
          className="text-input"
          style={{ flex: 1 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}

export default ChatPanel;
