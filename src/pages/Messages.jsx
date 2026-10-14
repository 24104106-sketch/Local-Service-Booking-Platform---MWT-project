import { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBookings } from "../hooks/useBookings";
import { useChat } from "../hooks/useChat";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import ChatPanel from "../components/ChatPanel";
import { useTranslation } from "../hooks/useTranslation";
import { formatRelativeTime } from "../utils/formatRelativeTime";

// A "conversation list" for a booking-scoped chat system (see useChat.js —
// chat is intentionally tied to a specific job, not an open-ended DM inbox)
// is just: every booking this user is part of that has at least one
// message, sorted by the most recent message. Reuses the exact same
// ChatPanel + Modal every other page already opens chat with — this page
// is only the index into those threads, not a second chat UI.
function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { messagesForBooking, unreadCountForBooking, loading: chatLoading } = useChat();
  const [openBooking, setOpenBooking] = useState(null);

  const role = user?.role === "provider" ? "provider" : "customer";

  const myBookings = useMemo(
    () => bookings.filter((b) => (role === "customer" ? b.customer === user?.name : b.provider === user?.name)),
    [bookings, user, role]
  );

  const conversations = useMemo(() => {
    return myBookings
      .map((b) => {
        const thread = messagesForBooking(b.id);
        if (thread.length === 0) return null;
        const last = thread[thread.length - 1];
        return {
          booking: b,
          otherParty: role === "customer" ? b.provider : b.customer,
          lastMessage: last,
          unread: unreadCountForBooking(b.id, role),
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
  }, [myBookings, messagesForBooking, unreadCountForBooking, role]);

  const loading = bookingsLoading || chatLoading;

  return (
    <Layout title={t("messages")}>
      <p className="page-intro">Every conversation tied to one of your bookings, most recent first.</p>

      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No conversations yet"
          message={`Chat with a ${role === "customer" ? "provider" : "customer"} from any active booking to start a conversation.`}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
          {conversations.map((c) => (
            <div
              key={c.booking.id}
              className="stat-card"
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
              onClick={() => setOpenBooking(c.booking)}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{c.otherParty}</strong>
                  {c.unread > 0 && (
                    <span style={{ background: "var(--red)", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                      {c.unread}
                    </span>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--muted)" }}>{c.booking.service} · {c.booking.id}</p>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: c.unread > 0 ? "var(--ink)" : "var(--muted)", fontWeight: c.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage.sender === role ? "You: " : ""}{c.lastMessage.text}
                </p>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--faint)", whiteSpace: "nowrap" }}>{formatRelativeTime(c.lastMessage.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {openBooking && (
        <Modal title={`💬 ${role === "customer" ? openBooking.provider : openBooking.customer}`} onClose={() => setOpenBooking(null)} width={420}>
          <ChatPanel booking={openBooking} role={role} myName={user?.name} />
        </Modal>
      )}
    </Layout>
  );
}

export default Messages;
