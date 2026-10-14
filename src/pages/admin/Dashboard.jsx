import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useFetch } from "../../hooks/useFetch";
import { useComplaints } from "../../hooks/useComplaints";
import { useBookings } from "../../hooks/useBookings";
import { fetchAdminStats, fetchProviderApplications } from "../../api/realApi";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import StatCard from "../../components/StatCard";
import DataTable from "../../components/DataTable";
import AnimatedGrid from "../../components/AnimatedGrid";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { parseAmount } from "../../utils/currency";

const APP_COLUMNS = [
  { key: "name", label: "Provider" },
  { key: "category", label: "Category" },
  { key: "appliedOn", label: "Applied On" },
  { key: "status", label: "Status" },
];

function AdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: rawStats } = useFetch(fetchAdminStats);
  const { data: rawApplications } = useFetch(fetchProviderApplications);
  const { complaints } = useComplaints();
  const { bookings } = useBookings();

  const stats = rawStats?.data || rawStats;
  const applications = Array.isArray(rawApplications?.data)
    ? rawApplications.data
    : (Array.isArray(rawApplications) ? rawApplications : []);

  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeComplaints = Array.isArray(complaints) ? complaints : [];

  const totalBookings = stats?.totalBookings ?? safeBookings.length;
  const revenue = useMemo(() => {
    if (stats?.totalRevenue != null) {
      return Number(stats.totalRevenue) || 0;
    }
    return safeBookings
      .filter((b) => b?.paymentStatus === "Paid")
      .reduce((sum, b) => sum + parseAmount(b?.amount || 0), 0);
  }, [safeBookings, stats]);

  const pendingApps = applications.filter(
    (a) => (a?.status || "").toLowerCase() === "pending" || a?.status === "Pending"
  );

  return (
    <Layout title={t("adminDashboard")}>
      <p className="page-intro">
        Welcome, {user?.name || "Admin"} — platform overview: users, providers, bookings and revenue at a glance.
      </p>

      {stats ? (
        <AnimatedGrid>
          <StatCard icon="👤" label="Total Users" value={stats.totalUsers ?? 0} sub="+42 this month" />
          <StatCard icon="🧰" label="Active Providers" value={stats.activeProviders ?? 0} sub={`${pendingApps.length} pending approval`} />
          <StatCard icon="📅" label="Total Bookings" value={totalBookings} sub="All time platform" />
          <StatCard icon="📊" label="Platform Revenue" value={`₹${revenue.toLocaleString("en-IN")}`} sub="Completed bookings" />
        </AnimatedGrid>
      ) : (
        <Skeleton variant="card" count={4} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{t("pendingApprovals")}</h3>
        {pendingApps.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12.5, color: "var(--blue)" }}
            onClick={() => navigate("/admin/provider-approvals")}
          >
            Manage Approvals ({pendingApps.length}) →
          </button>
        )}
      </div>

      {rawApplications ? (
        pendingApps.length === 0 ? (
          <EmptyState
            icon="🛡️"
            title="No pending approvals"
            message="All provider applications have been reviewed."
          />
        ) : (
          <DataTable columns={APP_COLUMNS} rows={pendingApps} />
        )
      ) : (
        <Skeleton variant="table" count={3} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Recent Complaints</h3>
        <button
          type="button"
          className="btn-ghost"
          style={{ fontSize: 12.5, color: "var(--blue)" }}
          onClick={() => navigate("/admin/complaints")}
        >
          View All Complaints →
        </button>
      </div>

      {safeComplaints.length === 0 ? (
        <EmptyState icon="📢" title="No complaints" message="Complaints raised by customers will appear here." />
      ) : (
        safeComplaints.slice(0, 5).map((c) => (
          <div
            key={c.id || Math.random()}
            className="stat-card"
            style={{
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
            onClick={() => navigate("/admin/complaints")}
          >
            <div>
              <strong style={{ color: "#ffffff" }}>{c.id || "Ticket"}</strong>
              <span style={{ color: "var(--muted)", margin: "0 8px" }}>—</span>
              <span style={{ color: "var(--ink)" }}>{c.type || "Inquiry"}</span>
              {c.bookingId && <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 8 }}>({c.bookingId})</span>}
            </div>
            <span className={`badge ${(c.status || "open").toLowerCase().replace(/\s+/g, "")}`}>{c.status || "Open"}</span>
          </div>
        ))
      )}
    </Layout>
  );
}

export default AdminDashboard;
