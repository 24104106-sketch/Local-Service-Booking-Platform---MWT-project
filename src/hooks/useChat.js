import { useContext, useCallback, useMemo } from "react";
import { ChatContext } from "../context/ChatContext";
import { useNotifications } from "./useNotifications";

/**
 * Custom hook — the single entry point for booking chat. Conversations are
 * scoped to a specific booking (not a generic customer<->provider DM),
 * matching how location sharing and tracking are already scoped — a chat
 * only makes sense in the context of a real job, not as an open-ended inbox.
 *
 * Usage:
 *   const { messagesForBooking, sendMessage } = useChat();
 *   const thread = messagesForBooking(booking.id);
 *   sendMessage(booking, "customer", user.name, text);
 */
export function useChat() {
  const { messages, dispatch, hydrated } = useContext(ChatContext);
  const { notify } = useNotifications();

  const messagesForBooking = useCallback(
    (bookingId) => messages.filter((m) => m.bookingId === bookingId),
    [messages]
  );

  const unreadCountForBooking = useCallback(
    (bookingId, myRole) =>
      messages.filter((m) => m.bookingId === bookingId && m.sender !== myRole && !m.read).length,
    [messages]
  );

  const markThreadRead = useCallback(
    (bookingId, myRole) => dispatch({ type: "MARK_THREAD_READ", bookingId, myRole }),
    [dispatch]
  );

  const sendMessage = useCallback(
    (booking, sender, senderName, text) => {
      const trimmed = text.trim();
      if (!trimmed || !booking) return;
      dispatch({
        type: "SEND",
        payload: {
          id: `MSG${Date.now()}`,
          bookingId: booking.id,
          sender, // "customer" | "provider"
          senderName,
          text: trimmed,
          timestamp: new Date().toISOString(),
          read: false,
        },
      });
      const recipient = sender === "customer" ? booking.provider : booking.customer;
      notify(recipient, `New message from ${senderName}`, trimmed.slice(0, 80));
    },
    [dispatch, notify]
  );

  return useMemo(
    () => ({ loading: !hydrated, messagesForBooking, unreadCountForBooking, sendMessage, markThreadRead }),
    [hydrated, messagesForBooking, unreadCountForBooking, sendMessage, markThreadRead]
  );
}
