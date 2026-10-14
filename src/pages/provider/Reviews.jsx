import { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useReviews } from "../../hooks/useReviews";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import AnimatedGrid from "../../components/AnimatedGrid";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

// Dedicated review browsing for a provider — Profile.jsx already surfaces
// the average rating and count, this is the actual list of what customers
// wrote, reusing the exact same reviewsForProvider() the customer-facing
// Provider Profile page uses (see hooks/useReviews.js) rather than a
// second reviews data source.
function ProviderReviews() {
  const { user } = useAuth();
  const { reviewsForProvider, loading } = useReviews();

  const reviews = useMemo(() => reviewsForProvider(user?.name), [reviewsForProvider, user]);
  const sorted = useMemo(() => [...reviews].sort((a, b) => (a.date < b.date ? 1 : -1)), [reviews]);

  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  const starCounts = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.rating === n).length);

  return (
    <Layout title="My Reviews">
      {loading ? (
        <Skeleton variant="card" count={2} />
      ) : (
        <AnimatedGrid>
          <StatCard icon="★" label="Average Rating" value={avgRating || "—"} sub={`${reviews.length} review${reviews.length !== 1 ? "s" : ""}`} />
          <StatCard icon="🏆" label="5-Star Reviews" value={starCounts[0]} sub="All time" />
        </AnimatedGrid>
      )}

      <h3>All Reviews</h3>
      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : sorted.length === 0 ? (
        <EmptyState icon="💬" title="No reviews yet" message="Reviews from customers will appear here once you complete jobs." />
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          {sorted.map((r) => (
            <div key={r.id} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 13 }}>{r.customer}</strong>
                <span style={{ color: "var(--blue)", fontSize: 12 }}>{"★".repeat(r.rating)}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted)" }}>{r.service}</p>
              {r.comment && <p style={{ margin: "6px 0 0", fontSize: 12 }}>{r.comment}</p>}
              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--faint)" }}>{r.date}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default ProviderReviews;
