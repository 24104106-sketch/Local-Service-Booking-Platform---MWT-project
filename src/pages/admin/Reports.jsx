import { useState, useCallback, useMemo } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useBookings } from "../../hooks/useBookings";
import { fetchReportTypes, generateReport } from "../../api/realApi";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import Skeleton from "../../components/Skeleton";
import { parseAmount } from "../../utils/currency";

// Fixed order/colors for the status breakdown bar — keeps the chart legible
// (grouped by lifecycle stage) instead of whatever order Object.entries happens to return.
const STATUS_ORDER = ["Pending", "Confirmed", "On The Way", "Arrived", "Service Started", "Completed", "Cancelled", "Rejected"];

function Reports() {
  const { t } = useTranslation();
  const { data: reportTypes, loading } = useFetch(fetchReportTypes);
  const { bookings, loading: bookingsLoading } = useBookings();
  const [generatingId, setGeneratingId] = useState(null);
  const [generated, setGenerated] = useState([]); // session history of generated reports

  const handleGenerate = useCallback(async (reportType) => {
    setGeneratingId(reportType.id);
    try {
      const report = await generateReport(reportType.id);
      setGenerated((prev) => [{ ...report, name: reportType.name, icon: reportType.icon }, ...prev]);
    } finally {
      setGeneratingId(null);
    }
  }, []);

  // Real analytics — computed directly from the shared booking store, so
  // this always reflects actual bookings made during the session (customer
  // Phase 3 flow) instead of a static snapshot.
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    bookings.forEach((b) => { if (counts[b.status] !== undefined) counts[b.status] += 1; });
    return counts;
  }, [bookings]);
  const maxCount = Math.max(1, ...Object.values(statusCounts));

  const revenueByCategory = useMemo(() => {
    const totals = {};
    bookings.filter((b) => b.paymentStatus === "Paid").forEach((b) => {
      const cat = b.category || "Other";
      totals[cat] = (totals[cat] || 0) + parseAmount(b.amount);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [bookings]);
  const maxRevenue = Math.max(1, ...revenueByCategory.map(([, v]) => v));

  return (
    <Layout title={t("reports")}>
      <p className="page-intro">Generate platform reports for revenue, bookings, users and complaints.</p>

      <h3 style={{ marginTop: 0 }}>Analytics</h3>
      {bookingsLoading ? (
        <Skeleton variant="card" count={2} />
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 32 }}>
          <div className="stat-card" style={{ flex: "1 1 320px" }}>
            <h4 style={{ marginTop: 0 }}>Bookings by Status</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STATUS_ORDER.map((status) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 100, fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{status}</span>
                  <div style={{ flex: 1, background: "var(--stripe)", borderRadius: 4, height: 14, overflow: "hidden" }}>
                    <div style={{ width: `${(statusCounts[status] / maxCount) * 100}%`, background: "var(--blue)", height: "100%", borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 20, fontSize: 11, fontWeight: 700, textAlign: "right" }}>{statusCounts[status]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card" style={{ flex: "1 1 320px" }}>
            <h4 style={{ marginTop: 0 }}>Revenue by Category</h4>
            {revenueByCategory.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12.5 }}>No paid bookings yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {revenueByCategory.map(([cat, revenue]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 100, fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{cat}</span>
                    <div style={{ flex: 1, background: "var(--stripe)", borderRadius: 4, height: 14, overflow: "hidden" }}>
                      <div style={{ width: `${(revenue / maxRevenue) * 100}%`, background: "var(--green)", height: "100%", borderRadius: 4 }} />
                    </div>
                    <span style={{ width: 60, fontSize: 11, fontWeight: 700, textAlign: "right" }}>₹{revenue.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <h3>Generate a Report</h3>
      {loading ? (
        <Skeleton variant="card" count={4} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
          {(Array.isArray(reportTypes?.data) ? reportTypes.data : (Array.isArray(reportTypes) ? reportTypes : [])).map((r) => (
            <div key={r.id} className="stat-card">
              <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
              <h4 style={{ margin: "0 0 4px 0" }}>{r.name}</h4>
              <p style={{ margin: "0 0 16px 0", color: "var(--muted)", fontSize: 12 }}>{r.description}</p>
              <button
                className="btn btn-primary"
                onClick={() => handleGenerate(r)}
                disabled={generatingId === r.id}
              >
                {generatingId === r.id ? "Generating..." : "Generate Report"}
              </button>
            </div>
          ))}
        </div>
      )}

      <h3>{t("generatedReports")}</h3>
      {generated.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 12.5 }}>No reports generated yet this session.</p>
      ) : (
        generated.map((g) => (
          <div
            key={g.id}
            className="stat-card"
            style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <strong>{g.icon} {g.name}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11.5 }}>
                {g.fileName} · Generated {g.generatedDate}
              </p>
            </div>
            <span className="badge active">Ready</span>
          </div>
        ))
      )}
    </Layout>
  );
}

export default Reports;
