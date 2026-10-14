import { useState } from "react";
import { useWallet } from "../../hooks/useWallet";
import { useToast } from "../../hooks/useToast";
import Layout from "../../components/Layout";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { useTranslation } from "../../hooks/useTranslation";

const QUICK_AMOUNTS = [200, 500, 1000, 2000];

function Wallet() {
  const { t } = useTranslation();
  const { balance, transactions, loading, actionLoading, addMoney } = useWallet();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");

  const handleAdd = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      showToast("Enter a valid amount to add.", "error");
      return;
    }
    try {
      await addMoney(value, method);
      showToast(`₹${value} added via ${method}`, "success");
      setAmount("");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <Layout title={t("wallet")}>
      <div className="stat-card" style={{ maxWidth: 420, marginBottom: 24 }}>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Current Balance</p>
        <p style={{ margin: "4px 0 20px", fontSize: 32, fontWeight: 800, color: "var(--blue)" }}>
          {loading ? <Skeleton width={140} height={32} /> : `₹${balance.toLocaleString("en-IN")}`}
        </p>

        <form onSubmit={handleAdd}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                className="btn btn-sm"
                style={String(amount) === String(a) ? { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" } : {}}
                onClick={() => setAmount(String(a))}
                disabled={actionLoading}
              >
                ₹{a}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min="1"
              className="text-input"
              style={{ flex: 1, minWidth: 120 }}
              placeholder="Amount to add"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={actionLoading}
            />
            <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={actionLoading} style={{ minWidth: 120 }}>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Net Banking">Net Banking</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? "Adding..." : "Add Money"}
            </button>
          </div>
        </form>
      </div>

      <h3>Transaction History</h3>
      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : transactions.length === 0 ? (
        <EmptyState icon="💳" title="No transactions yet" message="Money you add and payments you make with your wallet will show up here." />
      ) : (
        transactions.map((tx) => (
          <div
            key={tx.id}
            className="stat-card"
            style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <strong>{tx.note}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11.5 }}>{tx.date}</p>
            </div>
            <span style={{ fontWeight: 700, color: tx.type === "credit" ? "var(--green)" : "var(--red)" }}>
              {tx.type === "credit" ? "+" : "-"}₹{tx.amount}
            </span>
          </div>
        ))
      )}
    </Layout>
  );
}

export default Wallet;
