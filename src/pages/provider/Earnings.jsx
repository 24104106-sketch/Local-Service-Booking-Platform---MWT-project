import { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import AnimatedGrid from "../../components/AnimatedGrid";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { parseAmount, formatCurrency } from "../../utils/currency";

const COLUMNS = [
  { key: "id", label: "Booking ID" },
  { key: "customer", label: "Customer" },
  { key: "service", label: "Service" },
  { key: "date", label: "Completed On" },
  { key: "amount", label: "Amount" },
];

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function ProviderEarnings() {
  const { user } = useAuth();
  const { bookings, loading } = useBookings();

  const completed = useMemo(
    () => bookings.filter((b) => b.provider === user?.name && b.status === "Completed"),
    [bookings, user?.name]
  );

  const totalEarnings = useMemo(() => completed.reduce((sum, b) => sum + parseAmount(b.amount), 0), [completed]);

  const thisMonthLabel = currentMonthLabel();
  const thisMonthEarnings = useMemo(
    () => completed.filter((b) => b.date && b.date.includes(thisMonthLabel)).reduce((sum, b) => sum + parseAmount(b.amount), 0),
    [completed, thisMonthLabel]
  );

  const avgPerJob = completed.length ? Math.round(totalEarnings / completed.length) : 0;

  return (
    <Layout title="Earnings">
      <p className="page-intro">Your real earnings, computed from completed jobs — no separate ledger to keep in sync.</p>

      {loading ? (
        <Skeleton variant="card" count={4} />
      ) : (
        <AnimatedGrid>
          <StatCard icon="💰" label="Total Earnings" value={formatCurrency(totalEarnings)} sub="All time" />
          <StatCard icon="📆" label="This Month" value={formatCurrency(thisMonthEarnings)} sub={thisMonthLabel} />
          <StatCard icon="✅" label="Completed Jobs" value={completed.length} sub="All time" />
          <StatCard icon="📊" label="Avg per Job" value={formatCurrency(avgPerJob)} sub="All time" />
        </AnimatedGrid>
      )}

      <h3>Completed Jobs</h3>
      {loading ? (
        <Skeleton variant="table" count={4} />
      ) : completed.length === 0 ? (
        <EmptyState
          icon="💰"
          title="No completed jobs yet"
          message="Earnings will show up here once you complete your first booking."
        />
      ) : (
        <DataTable columns={COLUMNS} rows={completed} />
      )}
    </Layout>
  );
}

export default ProviderEarnings;
