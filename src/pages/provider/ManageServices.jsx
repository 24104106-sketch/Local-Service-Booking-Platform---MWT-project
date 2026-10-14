import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useServices } from "../../hooks/useServices";
import { useSearch } from "../../hooks/useSearch";
import { formatCurrency } from "../../utils/currency";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import FilterBar from "../../components/common/FilterBar";
import { apiClient } from "../../api/apiClient";
import { useToast } from "../../hooks/useToast";

const PRICING_TYPE_LABELS = {
  fixed: "Fixed Price",
  starting_from: "Starting From",
  inspection_required: "Inspection Required",
};

const EMPTY_NEW_SERVICE = {
  serviceId: "",
  serviceTitle: "",
  category: "Electrician",
  basePrice: "499",
  pricingType: "fixed",
  duration: "45–60 min",
};

function ManageServices() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { categories, services: catalogServices } = useServices();

  const [providerServices, setProviderServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState(EMPTY_NEW_SERVICE);
  const [searchParams] = useSearchParams();

  // Fetch provider's configured services from backend
  const fetchProviderServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/providers/services");
      if (res && res.success && Array.isArray(res.data)) {
        // Map backend columns to consistent state
        const mapped = res.data.map((ps) => ({
          id: ps.id,
          serviceId: ps.service_id,
          serviceTitle: ps.service_title || ps.name || "Custom Service",
          category: ps.category || "General",
          basePrice: ps.base_price ?? ps.custom_price ?? ps.master_price ?? 0,
          pricingType: ps.pricing_type || "fixed",
          isActive: ps.is_active !== false,
          duration: ps.duration || "45–60 min",
          // Editable state buffers
          editPrice: ps.base_price ?? ps.custom_price ?? ps.master_price ?? 0,
          editPricingType: ps.pricing_type || "fixed",
          editIsActive: ps.is_active !== false,
          isDirty: false,
        }));
        setProviderServices(mapped);
      } else {
        // Fallback to catalog services if no backend records
        const defaults = catalogServices.slice(0, 3).map((cs) => ({
          id: cs.id,
          serviceId: cs.id,
          serviceTitle: cs.title || cs.name,
          category: cs.category,
          basePrice: cs.price || 499,
          pricingType: "fixed",
          isActive: true,
          duration: cs.duration || "45–60 min",
          editPrice: cs.price || 499,
          editPricingType: "fixed",
          editIsActive: true,
          isDirty: false,
        }));
        setProviderServices(defaults);
      }
    } catch {
      // Offline fallback
      const defaults = catalogServices.slice(0, 3).map((cs) => ({
        id: cs.id,
        serviceId: cs.id,
        serviceTitle: cs.title || cs.name,
        category: cs.category,
        basePrice: cs.price || 499,
        pricingType: "fixed",
        isActive: true,
        duration: cs.duration || "45–60 min",
        editPrice: cs.price || 499,
        editPricingType: "fixed",
        editIsActive: true,
        isDirty: false,
      }));
      setProviderServices(defaults);
    } finally {
      setLoading(false);
    }
  }, [catalogServices]);

  useEffect(() => {
    fetchProviderServices();
  }, [fetchProviderServices]);

  // Search filtering
  const { query, setQuery, results, isSearching } = useSearch(providerServices, {
    keys: ["serviceTitle", "category"],
    initialQuery: searchParams.get("q") || "",
  });

  // Handle local buffer edit for base price
  const handlePriceChange = (id, val) => {
    setProviderServices((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const num = val === "" ? "" : Number(val);
          return {
            ...item,
            editPrice: num,
            isDirty: true,
          };
        }
        return item;
      })
    );
  };

  // Handle local buffer edit for pricing type
  const handlePricingTypeChange = (id, val) => {
    setProviderServices((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            editPricingType: val,
            isDirty: true,
          };
        }
        return item;
      })
    );
  };

  // Toggle active status
  const handleToggleStatus = (id) => {
    setProviderServices((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            editIsActive: !item.editIsActive,
            isDirty: true,
          };
        }
        return item;
      })
    );
  };

  // Save pricing changes for a single service to backend
  const handleSaveServicePricing = async (service) => {
    setSavingId(service.id);
    const targetServiceId = service.serviceId || service.id;
    try {
      await apiClient.put(`/providers/services/${targetServiceId}`, {
        basePrice: Number(service.editPrice) || 0,
        pricingType: service.editPricingType,
        isActive: service.editIsActive,
      });

      setProviderServices((prev) =>
        prev.map((item) =>
          item.id === service.id
            ? {
                ...item,
                basePrice: Number(service.editPrice) || 0,
                pricingType: service.editPricingType,
                isActive: service.editIsActive,
                isDirty: false,
              }
            : item
        )
      );
      showToast(`Pricing updated for ${service.serviceTitle}!`, "success");
    } catch {
      showToast("Failed to update pricing on server. Saved locally.", "warning");
      setProviderServices((prev) =>
        prev.map((item) =>
          item.id === service.id
            ? {
                ...item,
                basePrice: Number(service.editPrice) || 0,
                pricingType: service.editPricingType,
                isActive: service.editIsActive,
                isDirty: false,
              }
            : item
        )
      );
    } finally {
      setSavingId(null);
    }
  };

  // Remove service from provider's offered list
  const handleRemoveService = async (service) => {
    if (!window.confirm(`Are you sure you want to remove "${service.serviceTitle}" from your services?`)) {
      return;
    }
    const targetServiceId = service.serviceId || service.id;
    try {
      await apiClient.delete(`/providers/services/${targetServiceId}`);
      setProviderServices((prev) => prev.filter((s) => s.id !== service.id));
      showToast(`Removed "${service.serviceTitle}" from your services.`, "info");
    } catch {
      setProviderServices((prev) => prev.filter((s) => s.id !== service.id));
      showToast(`Removed "${service.serviceTitle}" locally.`, "info");
    }
  };

  // Add new service to provider profile
  const handleAddServiceSubmit = async (e) => {
    e.preventDefault();
    const { serviceId, serviceTitle, category, basePrice, pricingType } = newServiceForm;

    let finalTitle = serviceTitle.trim();
    let finalServiceId = serviceId;

    if (serviceId) {
      const selected = catalogServices.find((s) => String(s.id) === String(serviceId));
      if (selected) {
        finalTitle = selected.title || selected.name;
      }
    }

    if (!finalTitle && !finalServiceId) {
      showToast("Please choose or enter a service name.", "error");
      return;
    }

    try {
      const payload = {
        serviceId: finalServiceId ? Number(finalServiceId) : undefined,
        serviceTitle: finalTitle,
        category,
        basePrice: Number(basePrice) || 0,
        pricingType,
      };

      const res = await apiClient.post("/providers/services", payload);
      const createdItem = res?.data || {
        id: Date.now(),
        serviceId: finalServiceId || Date.now(),
        serviceTitle: finalTitle,
        category,
        basePrice: Number(basePrice) || 0,
        pricingType,
        isActive: true,
        duration: "45–60 min",
      };

      setProviderServices((prev) => [
        {
          id: createdItem.id,
          serviceId: createdItem.serviceId || createdItem.service_id,
          serviceTitle: finalTitle,
          category,
          basePrice: Number(basePrice) || 0,
          pricingType,
          isActive: true,
          duration: "45–60 min",
          editPrice: Number(basePrice) || 0,
          editPricingType: pricingType,
          editIsActive: true,
          isDirty: false,
        },
        ...prev,
      ]);

      showToast(`"${finalTitle}" added to your service catalog!`, "success");
      setShowAddModal(false);
      setNewServiceForm(EMPTY_NEW_SERVICE);
    } catch {
      showToast("Failed to add service. Please try again.", "error");
    }
  };

  const activeCount = providerServices.filter((s) => s.isActive).length;

  return (
    <Layout title={t("manageServices")}>
      {/* Header Info Banner */}
      <div className="info-banner-highlight">
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span>💼</span> My Services &amp; Pricing Configuration
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
            Configure your customized service rates. You can select Fixed Pricing, Starting From, or Inspection Required.
          </p>
        </div>
        <div className="flex-row gap-3">
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--blue)" }}>
              {providerServices.length}
            </span>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Total Services</div>
          </div>
          <div style={{ textAlign: "right", borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--green)" }}>
              {activeCount}
            </span>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Active</div>
          </div>
        </div>
      </div>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search your services by name or category..."
        isSearching={isSearching}
        actions={
          <button
            type="button"
            className="btn btn-primary flex-row items-center gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <span>+</span> Add Service to Profile
          </button>
        }
      />

      {/* Add Service Modal / Card */}
      {showAddModal && (
        <div
          className="stat-card"
          style={{
            maxWidth: 580,
            marginBottom: 24,
            border: "1px solid var(--blue)",
            boxShadow: "var(--shadow-md)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div className="card-header-row mb-3">
            <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🛠️</span> Add Service to Your Offerings
            </h4>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowAddModal(false)}
              style={{ background: "transparent", border: "none", fontSize: "1.1rem" }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleAddServiceSubmit}>
            <div className="field">
              <label>Select from Master Catalog</label>
              <select
                value={newServiceForm.serviceId}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = catalogServices.find((s) => String(s.id) === String(val));
                  setNewServiceForm((prev) => ({
                    ...prev,
                    serviceId: val,
                    serviceTitle: found ? (found.title || found.name) : prev.serviceTitle,
                    category: found ? found.category : prev.category,
                    basePrice: found?.price ? String(found.price) : prev.basePrice,
                  }));
                }}
              >
                <option value="">-- Or enter custom service below --</option>
                {catalogServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {!newServiceForm.serviceId && (
              <div className="field">
                <label>Custom Service Title *</label>
                <input
                  required
                  placeholder="e.g. Inverter Maintenance & Battery Check"
                  value={newServiceForm.serviceTitle}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, serviceTitle: e.target.value })}
                />
              </div>
            )}

            <div className="form-row-2col">
              <div className="field">
                <label>Category</label>
                <input
                  value={newServiceForm.category}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, category: e.target.value })}
                  placeholder="e.g. Electrician"
                />
              </div>

              <div className="field">
                <label>Pricing Type</label>
                <select
                  value={newServiceForm.pricingType}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, pricingType: e.target.value })}
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="starting_from">Starting From</option>
                  <option value="inspection_required">Inspection Required</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Base Price (₹) *</label>
              <div className="currency-input-container">
                <span className="currency-prefix">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="499"
                  value={newServiceForm.basePrice}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, basePrice: e.target.value })}
                  style={{ paddingLeft: 28 }}
                />
              </div>
              <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                This is your base rate charged to customers before travel or add-ons.
              </small>
            </div>

            <div className="card-actions-row" style={{ marginTop: 20 }}>
              <button type="submit" className="btn btn-primary">
                Add to My Services
              </button>
              <button type="button" className="btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services List Table */}
      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="🧰"
          title={query ? "No services match your search" : "No services configured yet"}
          message={
            query
              ? "Try searching for another service title or category."
              : "Add services to your profile and set your competitive prices."
          }
          actionLabel={query ? undefined : "+ Add Service to Profile"}
          onAction={query ? undefined : () => setShowAddModal(true)}
        />
      ) : (
        <div className="data-table-scroll">
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Service Offering</th>
                <th style={{ minWidth: 140 }}>Category</th>
                <th style={{ minWidth: 160 }}>Base Price (₹)</th>
                <th style={{ minWidth: 170 }}>Pricing Model</th>
                <th style={{ minWidth: 110 }}>Status</th>
                <th style={{ minWidth: 180, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((svc) => {
                const isSaving = savingId === svc.id;
                return (
                  <tr key={svc.id} style={{ opacity: svc.editIsActive ? 1 : 0.65 }}>
                    {/* Service Name */}
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{svc.serviceTitle}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Est. {svc.duration}</div>
                    </td>

                    {/* Category */}
                    <td>
                      <span
                        className="pill-badge"
                        style={{
                          background: "var(--blue-soft)",
                          color: "var(--blue)",
                        }}
                      >
                        {svc.category}
                      </span>
                    </td>

                    {/* Editable Base Price */}
                    <td>
                      <div className="flex-row items-center gap-1">
                        <span style={{ color: "var(--muted)", fontWeight: 600 }}>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={svc.editPrice}
                          onChange={(e) => handlePriceChange(svc.id, e.target.value)}
                          style={{
                            width: 100,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: svc.isDirty ? "1px solid var(--blue)" : "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--ink)",
                            fontWeight: 600,
                          }}
                        />
                      </div>
                    </td>

                    {/* Editable Pricing Type */}
                    <td>
                      <select
                        value={svc.editPricingType}
                        onChange={(e) => handlePricingTypeChange(svc.id, e.target.value)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: svc.isDirty ? "1px solid var(--blue)" : "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          fontSize: "0.85rem",
                        }}
                      >
                        <option value="fixed">Fixed Rate</option>
                        <option value="starting_from">Starting From</option>
                        <option value="inspection_required">Inspection Required</option>
                      </select>
                    </td>

                    {/* Active Status */}
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(svc.id)}
                        className={`pill-badge ${svc.editIsActive ? "pill-badge-success" : "pill-badge-muted"}`}
                        style={{
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "0.6rem" }}>{svc.editIsActive ? "●" : "○"}</span>
                        {svc.editIsActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div className="card-actions-row justify-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveServicePricing(svc)}
                          disabled={isSaving || !svc.isDirty}
                          style={{
                            padding: "4px 12px",
                            fontSize: "0.82rem",
                            opacity: svc.isDirty ? 1 : 0.6,
                          }}
                        >
                          {isSaving ? "Saving..." : svc.isDirty ? "Save Rate" : "Saved"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveService(svc)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.82rem",
                          }}
                          title="Remove from my services"
                        >
                          ✕
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
    </Layout>
  );
}

export default ManageServices;
