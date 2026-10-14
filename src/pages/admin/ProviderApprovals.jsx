import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";
import Layout from "../../components/Layout";
import Skeleton from "../../components/Skeleton";

function ProviderApprovals() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [poolStats, setPoolStats] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  // Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [editRadius, setEditRadius] = useState(15);
  const [updatingRadius, setUpdatingRadius] = useState(false);

  // Load pool stats
  const loadPoolStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiClient.get("/admin/providers/pool-stats");
      if (res && res.data) {
        setPoolStats(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Failed to load category pool stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load all providers
  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory && selectedCategory !== "all") {
        params.category = selectedCategory;
      }
      if (selectedStatus && selectedStatus !== "all") {
        params.status = selectedStatus;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await apiClient.get("/admin/providers", params);
      if (res && res.data) {
        setProviders(Array.isArray(res.data) ? res.data : []);
      } else {
        setProviders([]);
      }
    } catch (err) {
      console.error("Failed to load providers:", err);
      showToast(err.message || "Failed to load providers list", "error");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus, searchQuery, showToast]);

  useEffect(() => {
    loadPoolStats();
  }, [loadPoolStats]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Handle Approve / Reject
  const handleVerify = async (id, action) => {
    try {
      await apiClient.put(`/admin/providers/${id}/verify`, { action });
      showToast(
        action === "approve"
          ? "Provider approved successfully and added to active pool."
          : "Provider application rejected.",
        action === "approve" ? "success" : "info"
      );
      loadPoolStats();
      loadProviders();
    } catch (err) {
      showToast(err.message || `Failed to ${action} provider`, "error");
    }
  };

  // Handle Activate / Deactivate
  const handleToggleStatus = async (id, currentIsActive, category) => {
    const nextActive = !currentIsActive;
    try {
      await apiClient.put(`/admin/providers/${id}/status`, { isActive: nextActive });
      showToast(
        nextActive
          ? `Provider activated in ${category} pool.`
          : `Provider deactivated and removed from active pool.`,
        nextActive ? "success" : "info"
      );
      loadPoolStats();
      loadProviders();
    } catch (err) {
      showToast(err.message || "Failed to update provider status", "error");
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (providerId) => {
    setModalLoading(true);
    setSelectedProvider(null);
    try {
      const res = await apiClient.get(`/admin/providers/${providerId}`);
      if (res && res.data) {
        setSelectedProvider(res.data);
        setEditRadius(res.data.serviceRadius || res.data.service_radius || 15);
      }
    } catch (err) {
      showToast(err.message || "Failed to load provider details", "error");
    } finally {
      setModalLoading(false);
    }
  };

  // Save Service Radius
  const handleSaveRadius = async () => {
    if (!selectedProvider) return;
    const num = Number(editRadius);
    if (isNaN(num) || num <= 0) {
      showToast("Please enter a valid radius in km (greater than 0).", "error");
      return;
    }

    setUpdatingRadius(true);
    try {
      await apiClient.put(`/admin/providers/${selectedProvider.id}/radius`, { radius: num });
      showToast(`Service radius updated to ${num} km.`, "success");
      setSelectedProvider((prev) => (prev ? { ...prev, serviceRadius: num, service_radius: num } : null));
      loadProviders();
    } catch (err) {
      showToast(err.message || "Failed to update radius", "error");
    } finally {
      setUpdatingRadius(false);
    }
  };

  const getCategoryIcon = (cat) => {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("electric")) return "⚡";
    if (lower.includes("plumb")) return "🔧";
    if (lower.includes("carpent")) return "🪚";
    if (lower.includes("ac") || lower.includes("cool")) return "❄️";
    if (lower.includes("clean")) return "🧹";
    if (lower.includes("paint")) return "🎨";
    if (lower.includes("appliance")) return "📺";
    if (lower.includes("pest")) return "🐜";
    if (lower.includes("garden")) return "🌿";
    return "🛠️";
  };

  return (
    <Layout title="Provider Pool & Management">
      <div className="mb-5">
        <p className="page-intro" style={{ margin: 0 }}>
          Manage real provider pools across service categories. Each category supports up to 10 active approved providers.
        </p>
      </div>

      {/* Category Pool Overview */}
      <div className="mb-6">
        <div className="card-header-row mb-3">
          <h2 className="flex-row items-center gap-2" style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
            <span>Category Pool Status</span>
            <span className="pill-badge pill-badge-muted">
              Max 10 Active / Category
            </span>
          </h2>
          <button
            type="button"
            className="btn btn-outline btn-sm flex-row items-center gap-1"
            onClick={() => { loadPoolStats(); loadProviders(); }}
          >
            <span>🔄</span> Refresh Pool
          </button>
        </div>

        {statsLoading ? (
          <Skeleton variant="grid" count={4} />
        ) : (
          <div className="responsive-grid-auto">
            {poolStats.map((item) => {
              const isSelected = selectedCategory.toLowerCase() === item.category.toLowerCase();
              const isFull = item.isFull || item.active >= 10;
              const fillPercent = Math.min(100, Math.round((item.active / 10) * 100));

              return (
                <div
                  key={item.category}
                  onClick={() => setSelectedCategory(isSelected ? "all" : item.category)}
                  className="pool-stat-card"
                  style={{
                    border: isSelected ? "2px solid var(--blue)" : "1px solid var(--border)",
                    boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)"
                  }}
                >
                  <div className="flex-row justify-between items-start mb-2">
                    <div className="flex-row items-center gap-2">
                      <span style={{ fontSize: "1.3rem" }}>{getCategoryIcon(item.category)}</span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>{item.category}</strong>
                    </div>
                    {isFull ? (
                      <span className="pill-badge pill-badge-red">
                        FULL
                      </span>
                    ) : (
                      <span className="pill-badge pill-badge-success">
                        {item.remainingSlots} Slots Left
                      </span>
                    )}
                  </div>

                  <div className="flex-row items-baseline gap-1 mb-2">
                    <span style={{ fontSize: "1.4rem", fontWeight: 800, color: isFull ? "var(--amber)" : "var(--ink)" }}>
                      {item.active}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>/ 10 Active</span>
                  </div>

                  {/* Progress Meter */}
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${fillPercent}%`,
                        background: isFull ? "var(--amber)" : "var(--blue)"
                      }}
                    />
                  </div>

                  <div className="flex-row justify-between" style={{ fontSize: "0.75rem", color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    <span>Pending: <strong style={{ color: item.pending > 0 ? "var(--amber)" : "var(--ink)" }}>{item.pending}</strong></span>
                    <span>Available: <strong style={{ color: "var(--green)" }}>{item.availableNow}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-container">
        <div className="flex-row flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <input
            type="text"
            className="form-control filter-search-input"
            placeholder="Search provider, business, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Category Dropdown */}
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="all">All Categories</option>
            {poolStats.map((s) => (
              <option key={s.category} value={s.category}>
                {s.category} ({s.active}/10 Active)
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="status-button-group">
            {["all", "active", "pending", "inactive"].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${selectedStatus === st ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedStatus(st)}
                style={{ textTransform: "capitalize", padding: "4px 10px", fontSize: "0.8rem" }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Showing <strong>{providers.length}</strong> providers
        </div>
      </div>

      {/* Provider Table */}
      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : providers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-7)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", margin: 0 }}>No providers found matching your filter criteria.</p>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--stripe)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th className="table-cell-pad">Provider & Business</th>
                <th className="table-cell-pad">Category</th>
                <th className="table-cell-pad">Services Offered</th>
                <th className="table-cell-pad">Location & Radius</th>
                <th className="table-cell-pad">Coordinates</th>
                <th className="table-cell-pad">Availability</th>
                <th className="table-cell-pad">Pool Status</th>
                <th className="table-cell-pad" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const isApproved = p.is_approved === true || p.verification_status === "verified";
                const isPending = p.verification_status === "pending";
                const isRejected = p.verification_status === "rejected";
                const isActive = p.is_active !== false;

                const lat = p.latitude != null ? Number(p.latitude).toFixed(4) : null;
                const lng = p.longitude != null ? Number(p.longitude).toFixed(4) : null;
                const radiusKm = p.serviceRadius || p.service_radius || 15;

                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                    <td className="table-cell-pad">
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{p.business_name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        {p.user?.name} · {p.user?.phone || p.user?.email || "No contact"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                        ⭐ {Number(p.rating || 5).toFixed(1)} ({p.review_count || 0}) · {p.experience_years || p.experienceYears || 1} yrs exp · {p.completed_jobs || p.completedJobs || 0} jobs
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
                        📅 Submitted: {p.created_at || p.createdAt ? new Date(p.created_at || p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}
                      </div>
                    </td>

                    <td className="table-cell-pad">
                      <span className="flex-row items-center gap-1" style={{ fontWeight: 500, color: "var(--ink)" }}>
                        {getCategoryIcon(p.category)} {p.category}
                      </span>
                    </td>

                    <td className="table-cell-pad" style={{ maxWidth: 200 }}>
                      <div className="flex-row flex-wrap gap-1">
                        {(p.servicesOffered || []).length > 0 ? (
                          p.servicesOffered.slice(0, 2).map((s, idx) => (
                            <span key={idx} style={{ background: "var(--stripe)", padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem", border: "1px solid var(--border)" }}>
                              {s.title} (₹{s.basePrice || 299})
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>None mapped</span>
                        )}
                        {(p.servicesOffered || []).length > 2 && (
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>+{p.servicesOffered.length - 2} more</span>
                        )}
                      </div>
                    </td>

                    <td className="table-cell-pad">
                      <div style={{ color: "var(--ink)", fontWeight: 500 }}>{p.city || "Chennai"}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Radius: {radiusKm} km</div>
                    </td>

                    <td className="table-cell-pad">
                      {lat && lng ? (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                          📍 {lat}, {lng}
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 600 }}>⚠️ No GPS</span>
                      )}
                    </td>

                    <td className="table-cell-pad">
                      {p.availability_status === "AVAILABLE" || (p.is_available && p.availability_status !== "BUSY") ? (
                        <span className="pill-badge pill-badge-success">
                          <span className="status-dot status-dot-green" />
                          Available Now
                        </span>
                      ) : p.availability_status === "BUSY" ? (
                        <span className="pill-badge pill-badge-amber">
                          <span className="status-dot status-dot-amber" />
                          Busy
                        </span>
                      ) : (
                        <span className="pill-badge pill-badge-muted">
                          Offline
                        </span>
                      )}
                    </td>

                    <td className="table-cell-pad">
                      {isPending ? (
                        <span className="pill-badge pill-badge-amber">
                          Pending Review
                        </span>
                      ) : isRejected ? (
                        <span className="pill-badge pill-badge-red">
                          Rejected
                        </span>
                      ) : isActive ? (
                        <span className="pill-badge pill-badge-success">
                          Active (Pool)
                        </span>
                      ) : (
                        <span className="pill-badge pill-badge-muted">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="table-cell-pad" style={{ textAlign: "right" }}>
                      <div className="card-actions-row" style={{ display: "inline-flex" }}>
                        {isPending && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleVerify(p.id, "approve")}
                              title="Approve and add to active pool"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleVerify(p.id, "reject")}
                              title="Reject application"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {isApproved && (
                          <button
                            type="button"
                            className={`btn btn-sm ${isActive ? "btn-outline" : "btn-primary"}`}
                            onClick={() => handleToggleStatus(p.id, isActive, p.category)}
                            title={isActive ? "Deactivate provider" : "Activate provider in pool"}
                            style={{ minWidth: 84 }}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenDetails(p.id)}
                          title="View provider profile, location & radius"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider Details Modal */}
      {(selectedProvider || modalLoading) && (
        <div
          className="modal-overlay-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProvider(null);
          }}
        >
          <div className="modal-dialog-responsive">
            {modalLoading ? (
              <Skeleton variant="card" count={3} />
            ) : selectedProvider ? (
              <>
                <div className="card-header-row mb-4">
                  <div>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                      {selectedProvider.business_name || selectedProvider.businessName}
                    </h3>
                    <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.88rem" }}>
                      Owner: {selectedProvider.user?.name} · {selectedProvider.user?.email} · {selectedProvider.user?.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedProvider(null)}
                    style={{ fontSize: "1.2rem", padding: "2px 8px" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Pool & Verification Badges */}
                <div className="flex-row flex-wrap gap-2 mb-4">
                  <span className="pill-badge pill-badge-muted" style={{ padding: "4px 10px", borderRadius: 8, fontSize: "0.8rem" }}>
                    Category: <strong>{selectedProvider.category}</strong>
                  </span>
                  <span className="pill-badge pill-badge-muted" style={{ padding: "4px 10px", borderRadius: 8, fontSize: "0.8rem" }}>
                    Experience: <strong>{selectedProvider.experience_years || selectedProvider.experienceYears || 1} yrs</strong>
                  </span>
                  <span className="pill-badge pill-badge-muted" style={{ padding: "4px 10px", borderRadius: 8, fontSize: "0.8rem" }}>
                    Jobs Completed: <strong>{selectedProvider.completed_jobs || selectedProvider.completedJobs || 0}</strong>
                  </span>
                  <span className="pill-badge pill-badge-muted" style={{ padding: "4px 10px", borderRadius: 8, fontSize: "0.8rem" }}>
                    Rating: <strong>⭐ {Number(selectedProvider.rating || 5).toFixed(1)}</strong>
                  </span>
                </div>

                {/* Location Section */}
                <div style={{ background: "var(--stripe)", padding: "var(--space-4)", borderRadius: "var(--radius)", marginBottom: "var(--space-4)", border: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
                    📍 Physical & GPS Location (Admin View)
                  </h4>
                  <div style={{ fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.6 }}>
                    <div><strong>Street Address:</strong> {selectedProvider.address || selectedProvider.user?.address || "Address on file"}</div>
                    <div><strong>City / State:</strong> {selectedProvider.city || "Chennai"}, {selectedProvider.state || "Tamil Nadu"} - {selectedProvider.pincode || "600001"}</div>
                    <div style={{ marginTop: 6, fontFamily: "monospace", color: "var(--blue-dark)" }}>
                      <strong>Latitude:</strong> {selectedProvider.latitude != null ? selectedProvider.latitude : "Not set"} | <strong>Longitude:</strong> {selectedProvider.longitude != null ? selectedProvider.longitude : "Not set"}
                    </div>
                  </div>
                </div>

                {/* Service Radius Editor */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "var(--space-4)", borderRadius: "var(--radius)", marginBottom: "var(--space-4)" }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
                    🎯 Service Coverage Radius
                  </h4>
                  <div className="flex-row items-center gap-3">
                    <input
                      type="number"
                      className="form-control"
                      value={editRadius}
                      onChange={(e) => setEditRadius(e.target.value)}
                      min="1"
                      max="100"
                      style={{ width: 120 }}
                    />
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>km radius</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveRadius}
                      disabled={updatingRadius}
                    >
                      {updatingRadius ? "Saving..." : "Update Radius"}
                    </button>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block", marginTop: 6 }}>
                    Customers beyond this distance will not receive recommendations for this provider.
                  </small>
                </div>

                {/* Services Offered */}
                <div className="mb-4">
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
                    Services Offered ({selectedProvider.servicesOffered?.length || 0})
                  </h4>
                  <div className="flex-row flex-wrap gap-2">
                    {(selectedProvider.servicesOffered || []).map((s, idx) => (
                      <span
                        key={idx}
                        className="pill-badge pill-badge-muted"
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8rem"
                        }}
                      >
                        {s.title} · ₹{s.basePrice} ({s.pricingType})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-row justify-end" style={{ marginTop: "var(--space-4)" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setSelectedProvider(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default ProviderApprovals;
