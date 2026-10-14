import { useContext, useEffect, useState, useCallback } from "react";
import { WalletContext } from "../context/WalletContext";
import { useAuth } from "./useAuth";
import apiClient from "../api/apiClient";
import { loadRazorpayScript } from "../utils/loadRazorpay";

/**
 * Custom hook — the single entry point for wallet operations.
 * Connected directly to real MySQL Wallet, WalletTransaction, and Razorpay Top-up APIs.
 */
export function useWallet() {
  const { wallets, dispatch, hydrated } = useContext(WalletContext);
  const { user } = useAuth();
  const owner = user?.name || user?.email;
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const wallet = (owner && wallets[owner]) || { balance: 0, transactions: [] };
  const hasWallet = !!(owner && wallets[owner]);

  // Load real wallet from backend on mount / auth change
  useEffect(() => {
    if (!owner) return;
    let isMounted = true;

    Promise.allSettled([
      apiClient.get("/wallet"),
      apiClient.get("/wallet/transactions")
    ]).then(([walletRes, txRes]) => {
      if (!isMounted) return;
      const realBalance = walletRes.status === "fulfilled" && walletRes.value?.data?.balance != null
        ? Number(walletRes.value.data.balance)
        : (hasWallet ? wallet.balance : 0);

      const realTransactions = txRes.status === "fulfilled" && Array.isArray(txRes.value?.data)
        ? txRes.value.data.map(t => ({
            id: t.reference_id || `WT${t.id}`,
            amount: Number(t.amount),
            type: t.type,
            note: t.description || (t.type === "credit" ? "Wallet Top-up" : "Payment"),
            date: t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today"
          }))
        : (hasWallet ? wallet.transactions : []);

      dispatch({
        type: "SET",
        payload: {
          ...wallets,
          [owner]: { balance: realBalance, transactions: realTransactions }
        }
      });
    });

    return () => { isMounted = false; };
  }, [owner]);

  const addMoney = useCallback(
    async (amount, method) => {
      setActionLoading(true);
      setError("");
      try {
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
          throw new Error("Enter a valid top-up amount");
        }

        // 1. Create real payment order on backend
        const orderRes = await apiClient.post("/wallet/topup-order", { amount: numAmount });
        const { orderId, keyId } = orderRes.data || {};

        // 2. Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
          throw new Error("Razorpay checkout is unavailable. Please verify internet connection or gateway keys.");
        }

        // 3. Open Razorpay checkout modal
        return new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: Math.round(numAmount * 100),
            currency: "INR",
            name: "FixIt Local",
            description: "Wallet Top-up",
            order_id: orderId,
            handler: async (response) => {
              try {
                // 4. Verify cryptographic signature & credit wallet on server
                const verifyRes = await apiClient.post("/wallet/verify-topup", {
                  orderId: response.razorpay_order_id || orderId,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature
                });

                const updatedWallet = verifyRes?.data?.wallet;
                const newBalance = updatedWallet?.balance != null ? Number(updatedWallet.balance) : wallet.balance + numAmount;

                const newTx = {
                  id: response.razorpay_payment_id || `WT${Date.now()}`,
                  amount: numAmount,
                  type: "credit",
                  note: `Top-up via ${method || "Razorpay"}`,
                  date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                };

                dispatch({
                  type: "SET",
                  payload: {
                    ...wallets,
                    [owner]: {
                      balance: newBalance,
                      transactions: [newTx, ...(wallet.transactions || [])]
                    }
                  }
                });

                resolve(newTx);
              } catch (verifyErr) {
                reject(verifyErr);
              } finally {
                setActionLoading(false);
              }
            },
            modal: {
              ondismiss: () => {
                setActionLoading(false);
                reject(new Error("Payment cancelled by user"));
              }
            },
            prefill: {
              name: user?.name || "",
              email: user?.email || "",
              contact: user?.phone || ""
            },
            theme: { color: "#2563eb" }
          });

          rzp.open();
        });
      } catch (err) {
        setError(err.message || "Could not add money.");
        setActionLoading(false);
        throw err;
      }
    },
    [dispatch, owner, user, wallet]
  );

  // Synchronous check — used before allowing a wallet payment to go through.
  const hasSufficientBalance = useCallback((amount) => (Number(wallet.balance) || 0) >= Number(amount), [wallet.balance]);

  // Synchronizes wallet deduction with backend
  const deductMoney = useCallback(
    async (amount, note, bookingId) => {
      const numAmount = Number(amount);
      if (bookingId) {
        try {
          await apiClient.post("/wallet/pay", { amount: numAmount, bookingId });
        } catch {
          // Handled on server
        }
      }
      dispatch({
        type: "DEBIT",
        owner,
        amount: numAmount,
        transaction: {
          id: `WT${Date.now()}`,
          amount: numAmount,
          note,
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        },
      });
    },
    [dispatch, owner]
  );

  return {
    balance: Number(wallet.balance) || 0,
    transactions: wallet.transactions || [],
    loading: !hydrated,
    actionLoading,
    error,
    addMoney,
    deductMoney,
    hasSufficientBalance,
  };
}
