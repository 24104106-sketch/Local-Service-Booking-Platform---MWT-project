import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import FilterBar from "../../components/common/FilterBar";
import Modal from "../../components/Modal";
import GoogleMap from "../../components/maps/GoogleMap";

const COLUMNS = [
  { key: "name", label: "Community / Apartment" },
  { key: "areaCity", label: "Area & City" },
  { key: "address", label: "Street Address" },
  { key: "coordinates", label: "GPS Coordinates" },
  { key: "statusBadge", label: "Status" },
];

export default function ManageCommunities() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    city: "Chennai",
    area: "",
    pincode: "",
    isActive: true,
  });

  // Edit Modal State
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [viewingMapCommunity, setViewingMapCommunity] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const fetchCommunities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/communities?activeOnly=false");
      const list = res.data?.data || res.data || [];
      setCommunities(list);
    } catch (err) {
      showToast(err.message || "Failed to load communities", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim() || formData.latitude === "" || formData.longitude === "") {
      showToast("Please enter community name, address, latitude, and longitude.", "error");
      return;
    }

    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      showToast("Latitude must be between -90 and 90, Longitude between -180 and 180.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/admin/communities", {
        ...formData,
        latitude: lat,
        longitude: lng,
      });
      showToast(`Community "${formData.name}" added successfully.`, "success");
      setFormData({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        city: "Chennai",
        area: "",
        pincode: "",
        isActive: true,
      });
      fetchCommunities();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to add community", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const res = await apiClient.put(`/admin/communities/${item.id}/status`, {
        isActive: !item.is_active && !item.isActive,
      });
      showToast(res.data?.message || "Status updated", "success");
      fetchCommunities();
    } catch (err) {
      showToast(err.message || "Failed to toggle status", "error");
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCommunity) return;

    const lat = Number(editingCommunity.latitude);
    const lng = Number(editingCommunity.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      showToast("Latitude must be between -90 and 90, Longitude between -180 and 180.", "error");
      return;
    }

    try {
      await apiClient.put(`/admin/communities/${editingCommunity.id}`, {
        name: editingCommunity.name,
        address: editingCommunity.address,
        area: editingCommunity.area,
        city: editingCommunity.city,
        pincode: editingCommunity.pincode,
        latitude: lat,
        longitude: lng,
        isActive: editingCommunity.isActive ?? editingCommunity.is_active,
      });
      showToast("Community updated successfully", "success");
      setEditingCommunity(null);
      fetchCommunities();
    } catch (err) {
      showToast(err.message || "Failed to update community", "error");
    }
  };

  const handleDeleteCommunity = async (item) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}"? If bookings exist, it will be deactivated.`)) {
      return;
    }
    try {
      const res = await apiClient.delete(`/admin/communities/${item.id}`);
      showToast(res.data?.message || "Community removed", "success");
      fetchCommunities();
    } catch (err) {
      showToast(err.message || "Failed to delete community", "error");
    }
  };

  const filteredCommunities = useMemo(() => {
    if (!searchQuery.trim()) return communities;
    const q = searchQuery.toLowerCase().trim();
    return communities.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const address = (c.address || "").toLowerCase();
      const area = (c.area || "").toLowerCase();
      const city = (c.city || "").toLowerCase();
      const pin = (c.pincode || "").toLowerCase();
      return name.includes(q) || address.includes(q) || area.includes(q) || city.includes(q) || pin.includes(q);
    });
  }, [communities, searchQuery]);

  const tableRows = useMemo(() => {
    return filteredCommunities.map((c) => ({
      ...c,
      areaCity: `${c.area ? `${c.area}, ` : ""}${c.city || "Chennai"}${c.pincode ? ` (${c.pincode})` : ""}`,
      coordinates: `${Number(c.latitude).toFixed(4)}°, ${Number(c.longitude).toFixed(4)}°`,
      statusBadge: (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: (c.is_active || c.isActive) ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: (c.is_active || c.isActive) ? "#10b981" : "#ef4444",
          }}
        >
          {(c.is_active || c.isActive) ? "● Active" : "○ Inactive"}
        </span>
      ),
    }));
  }, [filteredCommunities]);

  return (
    <Layout title="Manage Communities">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px 0", color: "var(--ink)" }}>
          🏢 Manage Residential Communities &amp; Apartments
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
          Configure residential gated communities, complexes, and campuses. Customer discovery queries use these verified GPS coordinates to find nearby providers.
        </p>
      </div>

      {/* Add Community Form Card */}
      <div
        className="stat-card"
        style={{
          padding: 24,
          marginBottom: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700 }}>+ Add New Community</h3>
        <form onSubmit={handleCreateCommunity}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Community / Apartment Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. ABC Residency"
                value={formData.name}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Area / Locality
              </label>
              <input
                type="text"
                name="area"
                placeholder="e.g. Anna Nagar"
                value={formData.area}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                City
              </label>
              <input
                type="text"
                name="city"
                placeholder="Chennai"
                value={formData.city}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Pincode
              </label>
              <input
                type="text"
                name="pincode"
                placeholder="600040"
                value={formData.pincode}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Real Latitude (-90 to 90) *
              </label>
              <input
                type="number"
                step="0.0000001"
                name="latitude"
                required
                placeholder="e.g. 13.0827"
                value={formData.latitude}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Real Longitude (-180 to 180) *
              </label>
              <input
                type="number"
                step="0.0000001"
                name="longitude"
                required
                placeholder="e.g. 80.2100"
                value={formData.longitude}
                onChange={handleInputChange}
                className="text-input"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Full Address / Landmarks *
            </label>
            <input
              type="text"
              name="address"
              required
              placeholder="e.g. 2nd Avenue, Block A-D, Anna Nagar, Chennai"
              value={formData.address}
              onChange={handleInputChange}
              className="text-input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
              />
              <span>Mark as Active immediately</span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving Community..." : "Save Community"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter / Search Bar */}
      <FilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        placeholder="Search communities by name, address, area, city, pincode..."
        totalCount={communities.length}
        filteredCount={filteredCommunities.length}
      />

      {/* Data Table */}
      {loading ? (
        <Skeleton variant="table" count={4} />
      ) : tableRows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 36, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>No communities found</p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {searchQuery ? "Try widening your search criteria." : "Create your first residential community above."}
          </p>
        </div>
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={tableRows}
          renderActions={(row) => (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setViewingMapCommunity(row)}
                title="View community coordinates on map"
              >
                📍 Map
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setEditingCommunity(row)}
              >
                Edit
              </button>
              <button
                type="button"
                className={`btn btn-sm ${(row.is_active || row.isActive) ? "btn-danger" : "btn-primary"}`}
                onClick={() => handleToggleStatus(row)}
              >
                {(row.is_active || row.isActive) ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ color: "#ef4444" }}
                onClick={() => handleDeleteCommunity(row)}
                title="Delete Community"
              >
                🗑️
              </button>
            </div>
          )}
        />
      )}

      {/* Map View Modal */}
      {viewingMapCommunity && (
        <Modal
          title={`📍 Community Location: ${viewingMapCommunity.name}`}
          isOpen={!!viewingMapCommunity}
          onClose={() => setViewingMapCommunity(null)}
        >
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>{viewingMapCommunity.address}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              Latitude: <strong>{viewingMapCommunity.latitude}</strong> | Longitude: <strong>{viewingMapCommunity.longitude}</strong>
            </p>
          </div>
          <GoogleMap
            center={{ lat: Number(viewingMapCommunity.latitude), lng: Number(viewingMapCommunity.longitude) }}
            zoom={16}
            markers={[
              {
                lat: Number(viewingMapCommunity.latitude),
                lng: Number(viewingMapCommunity.longitude),
                title: viewingMapCommunity.name,
              },
            ]}
            height="320px"
            statusText={`GPS Center for ${viewingMapCommunity.name}`}
          />
        </Modal>
      )}

      {/* Edit Community Modal */}
      {editingCommunity && (
        <Modal
          title={`Edit Community: ${editingCommunity.name}`}
          isOpen={!!editingCommunity}
          onClose={() => setEditingCommunity(null)}
        >
          <form onSubmit={handleSaveEdit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Community Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCommunity.name}
                  onChange={(e) => setEditingCommunity({ ...editingCommunity, name: e.target.value })}
                  className="text-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={editingCommunity.address}
                  onChange={(e) => setEditingCommunity({ ...editingCommunity, address: e.target.value })}
                  className="text-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                    Area
                  </label>
                  <input
                    type="text"
                    value={editingCommunity.area || ""}
                    onChange={(e) => setEditingCommunity({ ...editingCommunity, area: e.target.value })}
                    className="text-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={editingCommunity.pincode || ""}
                    onChange={(e) => setEditingCommunity({ ...editingCommunity, pincode: e.target.value })}
                    className="text-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    required
                    value={editingCommunity.latitude}
                    onChange={(e) => setEditingCommunity({ ...editingCommunity, latitude: e.target.value })}
                    className="text-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    required
                    value={editingCommunity.longitude}
                    onChange={(e) => setEditingCommunity({ ...editingCommunity, longitude: e.target.value })}
                    className="text-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingCommunity(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
