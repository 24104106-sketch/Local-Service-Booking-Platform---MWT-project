import { createContext } from "react";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const ChatContext = createContext(null);

const STORAGE_KEY = "fixit_local_chats";

// Exported for direct unit testing (see __tests__/ChatContext.test.js).
export function chatReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "SEND":
      return [...state, action.payload];
    case "MARK_THREAD_READ":
      return state.map((m) =>
        m.bookingId === action.bookingId && m.sender !== action.myRole && !m.read ? { ...m, read: true } : m
      );
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [messages, dispatch, hydrated] = usePersistentReducer(
    chatReducer,
    [],
    STORAGE_KEY
  );

  return (
    <ChatContext.Provider value={{ messages, dispatch, hydrated }}>
      {children}
    </ChatContext.Provider>
  );
}
