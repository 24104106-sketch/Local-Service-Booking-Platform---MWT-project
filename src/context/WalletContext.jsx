import { createContext } from "react";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const WalletContext = createContext(null);

const STORAGE_KEY = "fixit_local_wallets"; // shape: { [ownerName]: { balance, transactions: [] } }

export function walletsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return typeof action.payload === "object" && action.payload ? action.payload : {};
    case "ENSURE_OWNER":
      return state[action.owner] ? state : { ...state, [action.owner]: action.wallet };
    case "CREDIT": {
      const w = state[action.owner] || { balance: 0, transactions: [] };
      return {
        ...state,
        [action.owner]: {
          balance: w.balance + action.amount,
          transactions: [{ ...action.transaction, type: "credit" }, ...w.transactions],
        },
      };
    }
    case "DEBIT": {
      const w = state[action.owner] || { balance: 0, transactions: [] };
      return {
        ...state,
        [action.owner]: {
          balance: w.balance - action.amount,
          transactions: [{ ...action.transaction, type: "debit" }, ...w.transactions],
        },
      };
    }
    default:
      return state;
  }
}

export function WalletProvider({ children }) {
  const [wallets, dispatch, hydrated] = usePersistentReducer(
    walletsReducer,
    {},
    STORAGE_KEY
  );

  return (
    <WalletContext.Provider value={{ wallets, dispatch, hydrated }}>
      {children}
    </WalletContext.Provider>
  );
}
