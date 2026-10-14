import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useServices } from "../../hooks/useServices";
import { useReviews } from "../../hooks/useReviews";
import { useFavorites } from "../../hooks/useFavorites";
import { useAvailability } from "../../hooks/useAvailability";
import { useBookings } from "../../hooks/useBookings";
import { formatCurrency } from "../../utils/currency";
import { getServiceImages } from "../../utils/serviceImages";
import Layout from "../../components/Layout";
import FavoriteButton from "../../components/FavoriteButton";
import { useTranslation } from "../../hooks/useTranslation";
import { recordRecentlyAccessed } from "../../api/realApi";
import "./ServiceDetails.css";

function ServiceDetails() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getServiceById } = useServices();
  const { reviewsForProvider } = useReviews();
  const { isFavoriteProvider, toggleFavoriteProvider } = useFavorites();
  const { getSlotsForDate } = useAvailability();
  const { bookings } = useBookings();

  const foundService = useMemo(() => getServiceById(id), [getServiceById, id]);
  const service = location.state?.service || foundService || {
    id,
    name: "AC Repair & Service",
    provider: "Kumar Cooling Co.",
    price: 499,
    duration: "45–60 min",
    category: "Home Appliances",
    rating: 4.6,
  };

  // Get centralized images & gallery for this service
  const imageBundle = useMemo(() => getServiceImages(service), [service]);
  const allGalleryImages = useMemo(() => [imageBundle.main, ...imageBundle.gallery], [imageBundle]);
  const allFallbackImages = useMemo(() => [imageBundle.fallbackMain, ...(imageBundle.fallbackGallery || [])], [imageBundle]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reset active index if service changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [service.id]);

  // Record access to this service for authenticated user
  useEffect(() => {
    if (service?.id) {
      const numericId = parseInt(service.id, 10);
      if (!isNaN(numericId) && numericId > 0) {
        recordRecentlyAccessed("service", numericId, {
          title: service.name || service.title,
          category: service.category,
          price: service.price
        }).catch(() => {});
      }
    }
  }, [service?.id]);

  const activeImage = allGalleryImages[activeImageIndex] || imageBundle.main;

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev === 0 ? allGalleryImages.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev === allGalleryImages.length - 1 ? 0 : prev + 1));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const availableSlots = useMemo(() => {
    const slots = getSlotsForDate(service.provider, todayStr, bookings);
    return slots.length > 0 ? slots : ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM"];
  }, [getSlotsForDate, service.provider, todayStr, bookings]);

  const [selectedSlot, setSelectedSlot] = useState(availableSlots[0]);

  const providerReviews = reviewsForProvider(service.provider);
  const liveAverage = providerReviews.length
    ? (providerReviews.reduce((sum, r) => sum + r.rating, 0) / providerReviews.length).toFixed(1)
    : "4.7";

  return (
    <Layout title={t("serviceDetails")}>
      {/* Top Back Navigation Link */}
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigate(-1)}
          style={{ padding: "4px 8px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          ← Back
        </button>
      </div>

      <div className="service-details-grid">
        {/* ================= LEFT MAIN COLUMN ================= */}
        <div className="service-details-left">
          {/* Main Image Gallery Card */}
          <div className="service-gallery-card">
            <div className="service-gallery-main">
              {/* Top Service Badge */}
              <div className="service-tag-badge">
                <span>🔧</span>
                <span>{service.name}</span>
              </div>

              {/* Carousel Arrows */}
              <button
                type="button"
                className="gallery-nav-btn prev"
                onClick={handlePrev}
                aria-label="Previous image"
              >
                ‹
              </button>

              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  src={activeImage}
                  alt={imageBundle.alt || service.name}
                  className="service-gallery-main-img"
                  onError={(e) => {
                    if (!e.target.dataset.fallbackTried) {
                      e.target.dataset.fallbackTried = "true";
                      const fallback = allFallbackImages[activeImageIndex] || imageBundle.fallbackMain;
                      e.target.src = fallback;
                    }
                  }}
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.85 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              <button
                type="button"
                className="gallery-nav-btn next"
                onClick={handleNext}
                aria-label="Next image"
              >
                ›
              </button>
            </div>

            {/* Thumbnail Preview Strip */}
            <div className="service-thumbnails-row">
              {allGalleryImages.map((imgSrc, idx) => (
                <button
                  key={imgSrc + idx}
                  type="button"
                  className={`service-thumbnail-btn ${activeImageIndex === idx ? "active" : ""}`}
                  onClick={() => setActiveImageIndex(idx)}
                >
                  <img
                    src={imgSrc}
                    alt={`${service.name} preview ${idx + 1}`}
                    className="service-thumbnail-img"
                    onError={(e) => {
                      if (!e.target.dataset.fallbackTried) {
                        e.target.dataset.fallbackTried = "true";
                        e.target.src = allFallbackImages[idx] || imageBundle.fallbackMain;
                      }
                    }}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title & Metadata */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800, color: "#ffffff" }}>
                {service.name}
              </h1>
              <FavoriteButton
                size={32}
                active={isFavoriteProvider(service.provider)}
                onToggle={() => toggleFavoriteProvider(service.provider)}
              />
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 10px 0" }}>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>★ {service.rating || "4.6"}</span>
              {" · "}
              <span>(256 reviews)</span>
              {" · "}
              <span>Est. {service.duration || "45–60 min"}</span>
              {" · "}
              <span style={{ color: "#93c5fd" }}>{service.category || "Home Appliances"}</span>
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              Professional doorstep service with verified background-checked experts. Genuine spare parts and service guarantee.
            </p>
          </div>

          {/* Provider Information Card */}
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Provider Information</h3>
            <div className="service-provider-card">
              <div className="provider-info-left">
                <div className="provider-avatar-circle">
                  🏢
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <strong style={{ fontSize: 15, color: "#ffffff" }}>{service.provider}</strong>
                    <span style={{ color: "#38bdf8", fontSize: 14 }}>✓</span>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 4px 0" }}>
                    Verified Provider · 8 Years Experience
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                    <span style={{ color: "#fbbf24" }}>★ {liveAverage}</span> ({providerReviews.length || 512} reviews) · 📍 2.3 km away
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => navigate(`/customer/providers/${encodeURIComponent(service.provider)}`)}
              >
                View Full Provider Profile
              </button>
            </div>
          </div>

          {/* What's Included & Why Choose Us */}
          <div className="service-features-grid">
            <div className="service-feature-box">
              <h4>What's Included?</h4>
              <ul className="feature-checklist">
                <li><span className="check-icon">✓</span> Complete inspection & diagnosis</li>
                <li><span className="check-icon">✓</span> Component repair & pressure test</li>
                <li><span className="check-icon">✓</span> Filter cleaning & sanitization</li>
                <li><span className="check-icon">✓</span> Performance validation check</li>
                <li><span className="check-icon">✓</span> 30-Day service warranty</li>
              </ul>
            </div>

            <div className="service-feature-box">
              <h4>Why Choose Us?</h4>
              <ul className="feature-checklist">
                <li><span className="check-icon">🛡️</span> Verified background-checked pros</li>
                <li><span className="check-icon">⚡</span> Upfront fixed transparent pricing</li>
                <li><span className="check-icon">🕒</span> On-time doorstep arrival</li>
                <li><span className="check-icon">✓</span> 100% Satisfaction guaranteed</li>
              </ul>
            </div>
          </div>

          {/* Recent Reviews Section */}
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Customer Reviews</h3>
            {providerReviews.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12.5 }}>No customer reviews recorded yet.</p>
            ) : (
              providerReviews.slice(0, 4).map((r) => (
                <div key={r.id} className="stat-card" style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 13 }}>{r.customer}</strong>
                    <span style={{ color: "#fbbf24", fontSize: 12 }}>{"★".repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>{r.comment}</p>}
                  <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--faint)" }}>{r.date}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR COLUMN ================= */}
        <div className="service-details-right">
          {/* Booking Card */}
          <div className="stat-card" style={{ padding: 22 }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: 15, color: "#ffffff" }}>Available Today</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="btn"
                  style={
                    slot === selectedSlot
                      ? {
                          background: "rgba(37, 99, 235, 0.25)",
                          borderColor: "#3b82f6",
                          color: "#93c5fd",
                          fontWeight: 700,
                        }
                      : {}
                  }
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Price:</span>
              <strong style={{ fontSize: 22, color: "#ffffff", fontWeight: 800 }}>
                {formatCurrency(service.price)}
              </strong>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", height: 46, fontSize: 14, fontWeight: 700 }}
              onClick={() => navigate("/customer/book", { state: { service, selectedSlot } })}
            >
              Book Service Now
            </button>

            <p style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", margin: "14px 0 0 0" }}>
              🛡️ No hidden charges. Pay after service.
            </p>
          </div>

          {/* Trust Badges Card */}
          <div className="trust-badges-card">
            <div className="trust-badge-row">
              <div className="trust-badge-icon">🛡️</div>
              <div className="trust-badge-text">
                <strong>Trusted & Verified</strong>
                <p>All professionals are background verified and certified.</p>
              </div>
            </div>

            <div className="trust-badge-row">
              <div className="trust-badge-icon">⚙️</div>
              <div className="trust-badge-text">
                <strong>Quality Guaranteed</strong>
                <p>Genuine spare parts and 30-day service warranty on every job.</p>
              </div>
            </div>

            <div className="trust-badge-row">
              <div className="trust-badge-icon">🎧</div>
              <div className="trust-badge-text">
                <strong>24/7 Support</strong>
                <p>Our dedicated support team is always ready to assist you.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ServiceDetails;
