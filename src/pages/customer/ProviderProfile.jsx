import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useReviews } from "../../hooks/useReviews";
import { useFavorites } from "../../hooks/useFavorites";
import { fetchProviderByName, recordRecentlyAccessed } from "../../api/realApi";
import Layout from "../../components/Layout";
import Skeleton from "../../components/Skeleton";
import FavoriteButton from "../../components/FavoriteButton";
import EmptyState from "../../components/EmptyState";
import { useTranslation } from "../../hooks/useTranslation";

function getInitials(name) {
  return name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?";
}

// A dedicated page for "View Provider Profile" — pulls the fuller profile
// (bio, experience, verification, join date) plus every service they offer
// and their live review history, all in one place.
function ProviderProfile() {
  const { t } = useTranslation();
  const { name } = useParams();
  const decodedName = decodeURIComponent(name);
  const navigate = useNavigate();
  const { data: rawProvider, loading: providerLoading } = useFetch(() => fetchProviderByName(decodedName), [decodedName]);
  const { reviewsForProvider } = useReviews();
  const { isFavoriteProvider, toggleFavoriteProvider } = useFavorites();

  const provider = rawProvider ? {
    ...rawProvider,
    name: rawProvider.business_name || rawProvider.user?.name || rawProvider.name || decodedName,
    verified: rawProvider.is_approved || rawProvider.verification_status === "verified" || rawProvider.verified,
    category: rawProvider.service_category || rawProvider.category || "Home Services",
    experience: rawProvider.experience_years ?? rawProvider.experience ?? 1,
    completedJobs: rawProvider.completed_jobs ?? rawProvider.completedJobs ?? 0,
    serviceRadius: rawProvider.serviceRadius ?? rawProvider.service_radius ?? 15,
    area: rawProvider.city || rawProvider.serviceArea || "Chennai",
    availabilityStatus: rawProvider.availabilityStatus || rawProvider.availability_status || (rawProvider.is_available !== false ? "AVAILABLE" : "BUSY"),
    bio: rawProvider.bio || "Professional verified local service provider.",
  } : null;

  const rawServicesList = rawProvider?.servicesOffered || rawProvider?.services || [];
  const services = (Array.isArray(rawServicesList) ? rawServicesList : []).map((s) => ({
    ...s,
    name: s.title || s.name || "Home Service",
    price: s.price != null ? s.price : (s.basePrice || 499),
    duration: s.duration || "1-2 hours",
    rating: s.rating || 5,
  }));

  const reviews = reviewsForProvider(provider?.name || decodedName);
  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  const loading = providerLoading;

  useEffect(() => {
    if (rawProvider?.id || rawProvider?.user_id) {
      const targetId = Number(rawProvider.id || rawProvider.user_id);
      if (!isNaN(targetId) && targetId > 0) {
        recordRecentlyAccessed("provider", targetId, {
          name: provider?.name || decodedName,
          category: provider?.category || "Home Services"
        }).catch(() => {});
      }
    }
  }, [rawProvider?.id, rawProvider?.user_id, decodedName, provider?.name, provider?.category]);

  return (
    <Layout title={t("serviceDetails")}>
      {loading ? (
        <Skeleton variant="card" count={1} height={140} />
      ) : !provider ? (
        <EmptyState icon="🔍" title="Provider not found" message="This provider may no longer be active on the platform." actionLabel="Back to Browse" onAction={() => navigate("/customer/services")} />
      ) : (
        <>
          <div className="stat-card" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%", background: "var(--blue-soft)", color: "var(--blue)",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, flexShrink: 0,
              }}
            >
              {getInitials(provider.name)}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>{provider.name}</h2>
                {provider.verified && <span className="badge active">✓ Verified</span>}
                {provider.availabilityStatus === "AVAILABLE" ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--green-bg)", color: "var(--green)" }}>
                    ● Available Now
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--amber-bg)", color: "var(--amber)" }}>
                    ● Currently Busy
                  </span>
                )}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "4px 0 0" }}>
                {provider.category} · {provider.experience} years exp · 📍 {provider.area} ({provider.serviceRadius} km radius)
              </p>
              <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "4px 0 0" }}>
                ★ {avgRating || Number(provider.rating || 5).toFixed(1)} ({reviews.length || provider.review_count || 0} reviews) · 💼 {provider.completedJobs} jobs completed
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const firstSvc = services[0];
                  navigate("/customer/book", {
                    state: {
                      service: firstSvc || { provider: provider.name, category: provider.category, price: 450 }
                    }
                  });
                }}
              >
                Book This Provider
              </button>
              <FavoriteButton
                size={38}
                active={isFavoriteProvider(provider.name)}
                onToggle={() => toggleFavoriteProvider(provider.name)}
              />
            </div>
          </div>

          <p style={{ color: "var(--muted)", maxWidth: 640, marginBottom: 24 }}>{provider.bio}</p>

          <h3>Services Offered</h3>
          {services.length === 0 ? (
            <EmptyState icon="🧰" title="No active services" message="This provider hasn't listed any services yet." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              {services.map((s) => (
                <div key={s.id} className="stat-card">
                  <h4 style={{ margin: "0 0 4px 0" }}>{s.name}</h4>
                  <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--muted)" }}>{"★".repeat(s.rating || 5)} · {s.duration}</p>
                  <p style={{ fontWeight: 700, color: "var(--blue)", fontSize: 15, marginBottom: 10 }}>₹{s.price}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/customer/services/${s.id}`, { state: { service: s } })}>
                      {t("viewDetails")}
                    </button>
                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => navigate("/customer/book", { state: { service: s } })}>
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3>Reviews</h3>
          {reviews.length === 0 ? (
            <EmptyState icon="💬" title="No reviews yet" message="Be the first to book and review this provider." />
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="stat-card" style={{ maxWidth: 560, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 13 }}>{r.customer}</strong>
                  <span style={{ color: "var(--blue)", fontSize: 12 }}>{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{r.comment}</p>}
                <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--faint)" }}>{r.date}</p>
              </div>
            ))
          )}
        </>
      )}
    </Layout>
  );
}

export default ProviderProfile;
