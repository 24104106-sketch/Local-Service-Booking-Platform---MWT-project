import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServices } from "../../hooks/useServices";
import { useSearch } from "../../hooks/useSearch";
import { useSort } from "../../hooks/useSort";
import { useFavorites } from "../../hooks/useFavorites";
import { distanceKm } from "../../utils/distance";
import apiClient from "../../api/apiClient";
import { formatCurrency } from "../../utils/currency";
import { getServiceCoverImage, getServiceImages } from "../../utils/serviceImages";
import Layout from "../../components/Layout";
import Skeleton from "../../components/Skeleton";
import FavoriteButton from "../../components/FavoriteButton";
import EmptyState from "../../components/EmptyState";
import CustomDropdown from "../../components/common/CustomDropdown";
import { useTranslation } from "../../hooks/useTranslation";
import "./BrowseServices.css";

const PRICE_RANGES = {
  "All Prices": () => true,
  "Under ₹500": (p) => p < 500,
  "₹500 – ₹1000": (p) => p >= 500 && p <= 1000,
  "Above ₹1000": (p) => p > 1000,
};

const RATING_OPTIONS = {
  "Any Rating": () => true,
  "4★ & above": (r) => r >= 4,
  "3★ & above": (r) => r >= 3,
};

function BrowseServices() {
  const { t } = useTranslation();
  const { activeServices, categories, loading } = useServices();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchRef = useRef(null);
  const { isFavoriteProvider, toggleFavoriteProvider } = useFavorites();

  const { query, setQuery, filterValue, setFilterValue, filterOptions, results, isSearching } = useSearch(
    activeServices,
    { keys: ["name", "provider", "category"], filterKey: "category", initialQuery: searchParams.get("q") || "" }
  );

  const [priceRange, setPriceRange] = useState("All Prices");
  const [minRating, setMinRating] = useState("Any Rating");

  const [myLocation, setMyLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");

  const requestNearby = () => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("success");
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [providers, setProviders] = useState([]);

  useEffect(() => {
    let isMounted = true;
    apiClient.get("/providers")
      .then((res) => {
        if (isMounted && res?.data && Array.isArray(res.data)) {
          setProviders(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const providerByName = useMemo(() => {
    const map = {};
    providers.forEach((p) => {
      const name = p.business_name || p.user?.name || p.name;
      if (name) map[name] = p;
    });
    return map;
  }, [providers]);

  const withDistance = useMemo(() => {
    if (!myLocation) return results;
    return results.map((s) => {
      const p = providerByName[s.provider] || (s.providerLat && s.providerLng ? { lat: s.providerLat, lng: s.providerLng } : null);
      const lat = p?.lat ?? p?.latitude ?? p?.user?.latitude;
      const lng = p?.lng ?? p?.longitude ?? p?.user?.longitude;
      const distance = (lat && lng) ? distanceKm(myLocation.lat, myLocation.lng, lat, lng) : null;
      return { ...s, distance };
    });
  }, [results, myLocation, providerByName]);

  const filtered = useMemo(
    () => withDistance.filter((s) => PRICE_RANGES[priceRange](s.price) && RATING_OPTIONS[minRating](s.rating)),
    [withDistance, priceRange, minRating]
  );

  const { sorted, sortKey, direction, setSortKey, setDirection } = useSort(filtered);
  const sortValue = !sortKey ? "relevance" : `${sortKey}-${direction}`;

  const handleResetFilters = () => {
    setQuery("");
    setFilterValue("All");
    setPriceRange("All Prices");
    setMinRating("Any Rating");
    setSortKey(null);
    if (searchRef.current) {
      searchRef.current.focus();
    }
  };

  useEffect(() => {
    if (!loading && searchRef.current) {
      searchRef.current.focus();
    }
  }, [loading]);

  const categoryFilterList = useMemo(() => {
    const dynamicNames = categories.map((c) => c.name);
    return Array.from(new Set(["All", ...filterOptions, ...dynamicNames]));
  }, [filterOptions, categories]);

  return (
    <Layout title={t("browseServices")}>
      {/* Enhanced Browse Services Filter Header Card */}
      <div className="browse-services-header-card">
        {/* Top Title & Breadcrumb Meta */}
        <div className="browse-header-top-row">
          <div className="browse-title-group">
            <div className="browse-blue-accent-bar" />
            <div>
              <h2 className="browse-main-title">{t("browseServices")}</h2>
              <p className="browse-main-subtitle">Find the best local services near you</p>
            </div>
          </div>
          <div className="browse-meta-breadcrumbs">
            <span>Explore</span>
            <span className="dot">•</span>
            <span>Compare</span>
            <span className="dot">•</span>
            <span>Book</span>
          </div>
        </div>

        <div className="browse-header-divider" />

        {/* Bottom Filters Controls Row */}
        <div className="browse-filters-row">
          {/* Custom Search Box */}
          <div className="browse-search-wrapper">
            <span className="browse-search-icon">🔍</span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search for a service..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="browse-search-input"
            />
            <span className="browse-filter-sliders-icon" title="Filter options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
            </span>
          </div>

          {/* 1. Category Custom Dropdown */}
          <CustomDropdown
            icon={<span style={{ color: "#3b82f6", fontSize: 16 }}>⊞</span>}
            label="All Categories"
            value={filterValue}
            options={categoryFilterList.map((c) => ({
              value: c,
              label: c === "All" ? "All Categories" : c,
            }))}
            onChange={(val) => setFilterValue(val)}
          />

          {/* 2. Price Range Custom Dropdown */}
          <CustomDropdown
            icon={<span className="price-badge-icon">₹</span>}
            label="Any Price"
            value={priceRange}
            options={Object.keys(PRICE_RANGES).map((k) => ({
              value: k,
              label: k === "All Prices" ? "Any Price" : k,
            }))}
            onChange={(val) => setPriceRange(val)}
          />

          {/* 3. Rating Custom Dropdown */}
          <CustomDropdown
            icon={<span style={{ color: "#f59e0b", fontSize: 15 }}>⭐</span>}
            label="Any Rating"
            value={minRating}
            options={Object.keys(RATING_OPTIONS).map((k) => ({
              value: k,
              label: k,
            }))}
            onChange={(val) => setMinRating(val)}
          />

          {/* 4. Sort Custom Dropdown */}
          <CustomDropdown
            icon={<span style={{ color: "#a855f7", fontSize: 15 }}>⇅</span>}
            label="Sort: Relevance"
            value={sortValue}
            options={[
              { value: "relevance", label: "Sort: Relevance" },
              { value: "price-asc", label: "Price: Low to High" },
              { value: "price-desc", label: "Price: High to Low" },
              { value: "rating-desc", label: "Rating: High to Low" },
              { value: "distance-asc", label: "📍 Nearest to Me" },
            ]}
            onChange={(val) => {
              if (val === "relevance") {
                setSortKey(null);
                return;
              }
              if (val === "distance-asc" && locationStatus !== "success") {
                requestNearby();
              }
              const [key, dir] = val.split("-");
              setSortKey(key);
              setDirection(dir);
            }}
          />

          {/* Reset Filters Button */}
          {(query || filterValue !== "All" || priceRange !== "All Prices" || minRating !== "Any Rating" || sortKey) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleResetFilters}
              style={{ height: 44, borderRadius: 12, padding: "0 14px" }}
            >
              Reset
            </button>
          )}

          {isSearching && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Searching...</span>}
        </div>
      </div>

      {locationStatus === "loading" && (
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -14, marginBottom: 16 }}>
          Getting your location to find nearby providers...
        </p>
      )}
      {locationStatus === "error" && (
        <p style={{ fontSize: 11.5, color: "var(--red)", marginTop: -14, marginBottom: 16 }}>
          Couldn't access your location — check browser permissions to sort by nearest.
        </p>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          <Skeleton variant="table" count={1} height={260} />
          <Skeleton variant="table" count={1} height={260} />
          <Skeleton variant="table" count={1} height={260} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="🔎"
          title="No services match your filters"
          message="Try widening your search, or reset filters to see everything."
          actionLabel="Reset Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
          {sorted.map((s) => (
            <div
              key={s.id}
              className="stat-card"
              style={{
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {/* Service Card Image Banner */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 10",
                  overflow: "hidden",
                  background: "#080e1a",
                }}
              >
                <img
                  src={getServiceCoverImage(s)}
                  alt={s.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  onError={(e) => {
                    if (!e.target.dataset.fallbackTried) {
                      e.target.dataset.fallbackTried = "true";
                      const bundle = getServiceImages(s);
                      e.target.src = bundle.fallbackMain || bundle.main;
                    }
                  }}
                  loading="lazy"
                />

                {/* Category Badge Overlay */}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(15, 23, 42, 0.85)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#93c5fd",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 6,
                  }}
                >
                  {s.category}
                </span>

                {/* Favorite Button Overlay */}
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <FavoriteButton
                    isFavorite={isFavoriteProvider(s.provider)}
                    onToggle={() => toggleFavoriteProvider(s.provider)}
                  />
                </div>
              </div>

              {/* Service Card Info Content */}
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700 }}>{s.name}</h4>

                <p
                  style={{
                    margin: "0 0 10px 0",
                    color: "var(--muted)",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>🧰</span>
                  <span>{s.provider}</span>
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                    color: "var(--muted)",
                    marginBottom: 16,
                  }}
                >
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>{"★".repeat(s.rating || 5)}</span>
                  <span>•</span>
                  <span>{s.duration || "45–60 min"}</span>
                  {s.distance != null && (
                    <>
                      <span>•</span>
                      <span style={{ color: "var(--blue)", fontWeight: 600 }}>📍 {s.distance.toFixed(1)} km</span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10.5, color: "var(--muted)", display: "block" }}>Starting from</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{formatCurrency(s.price)}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigate(`/customer/services/${s.id}`, { state: { service: s } })}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate("/customer/book", { state: { service: s } })}
                    >
                      Book Now →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default BrowseServices;
