import { useMemo } from "react";
import { useBookings } from "../../hooks/useBookings";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import AnimatedGrid from "../../components/AnimatedGrid";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { parseAmount } from "../../utils/currency";

const COLUMNS = [
  { key: "id", label: "Booking ID" },
  { key: "customer", label: "Customer" },
  { key: "provider", label: "Provider" },
  { key: "amount", label: "Amount" },
  { key: "paymentMethod", label: "Method" },
  { key: "paymentStatus", label: "Status" },
];

// Real payments + commission, computed from the same shared booking store
// every other role reads — no separate "payments" mock dataset to drift
// out of sync. The commission % is the actual value an admin sets on
// Settings > Payment & Commission (useSettingsStore "paymentCommission"),
// not a second hardcoded number living only on this page.
function AdminPayments() {
  const { bookings, loading } = useBookings();
  const [{ commissionPercent }] = useSettingsStore("paymentCommission", { commissionPercent: 15, payoutCycle: "weekly", minPayoutAmount: 500 });

  const paid = useMemo(() => bookings.filter((b) => b.paymentStatus === "Paid"), [bookings]);
  const totalRevenue = useMemo(() => paid.reduce((sum, b) => sum + parseAmount(b.amount), 0), [paid]);
  const platformCommission = Math.round(totalRevenue * (commissionPercent / 100));
  const providerPayouts = totalRevenue - platformCommission;
  const unpaidCount = useMemo(() => bookings.filter((b) => b.paymentStatus === "Unpaid").length, [bookings]);

  return (
    <Layout title="Payments & Commission">
      <p className="page-intro">
        Computed live from every paid booking, at the platform's current {commissionPercent}% commission rate
        (adjustable in Settings &gt; Payment &amp; Commission).
      </p>

      {loading ? (
        <Skeleton variant="card" count={4} />
      ) : (
        <AnimatedGrid>
          <StatCard icon="💰" label="Total Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} sub="All paid bookings" />
          <StatCard icon="🏦" label="Platform Commission" value={`₹${platformCommission.toLocaleString("en-IN")}`} sub={`${commissionPercent}% cut`} />
          <StatCard icon="👷" label="Provider Payouts" value={`₹${providerPayouts.toLocaleString("en-IN")}`} sub="After commission" />
          <StatCard icon="⏳" label="Unpaid Bookings" value={unpaidCount} sub="Cash on completion" />
        </AnimatedGrid>
      )}

      <h3>Payment Transactions</h3>
      {loading ? (
        <Skeleton variant="table" count={4} />
      ) : paid.length === 0 ? (
        <EmptyState icon="💳" title="No payments yet" message="Paid bookings will show up here as customers pay." />
      ) : (
        <DataTable columns={COLUMNS} rows={paid} />
      )}
    </Layout>
  );
}

export default AdminPayments;
