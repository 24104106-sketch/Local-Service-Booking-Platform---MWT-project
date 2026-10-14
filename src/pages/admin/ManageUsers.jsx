import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSearch } from "../../hooks/useSearch";
import { usePagination } from "../../hooks/usePagination";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import FilterBar from "../../components/common/FilterBar";
import Modal from "../../components/Modal";
import Badge from "../../components/Badge";

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "roleDisplay", label: "Role" },
  { key: "joined", label: "Joined" },
  { key: "status", label: "Status" },
];

const PAGE_SIZE = 8;

function ManageUsers() {
  const { t } = useTranslation();
  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/admin/users");
      if (res && res.success && Array.isArray(res.data)) {
        setUsers(
          res.data.map((u) => ({
            ...u,
            status: u.status
              ? u.status.charAt(0).toUpperCase() + u.status.slice(1).toLowerCase()
              : "Active",
            joined: u.created_at
              ? new Date(u.created_at).toLocaleDateString()
              : u.joined || "—",
            phone: u.phone || "—",
            roleDisplay: u.role
              ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
              : "Customer",
          }))
        );
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.warn("Error fetching platform users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const {
    query,
    setQuery,
    filterValue,
    setFilterValue,
    filterOptions,
    results,
    isSearching,
  } = useSearch(users, {
    keys: ["name", "email", "phone"],
    filterKey: "role",
    initialQuery: searchParams.get("q") || "",
  });

  const finalFiltered = results.filter((u) => {
    if (!statusFilter || statusFilter.toLowerCase() === "all") return true;
    return (u.status || "").toLowerCase() === statusFilter.toLowerCase();
  });

  const { page, totalPages, paginated, nextPage, prevPage, hasNext, hasPrev } =
    usePagination(finalFiltered, PAGE_SIZE);

  const handleToggleStatus = useCallback(
    async (row) => {
      const isSelf =
        currentAdmin &&
        (currentAdmin.id === row.id || currentAdmin.email === row.email);
      if (isSelf) {
        showToast("You cannot suspend your own admin account.", "error");
        return;
      }
      if ((row.role || "").toLowerCase() === "admin") {
        showToast("Admin accounts cannot be suspended.", "error");
        return;
      }

      const nextStatusRaw =
        (row.status || "").toLowerCase() === "active" ? "suspended" : "active";
      const nextStatusDisplay =
        nextStatusRaw === "active" ? "Active" : "Suspended";

      try {
        await apiClient.put(`/admin/users/${row.id}/status`, {
          status: nextStatusRaw,
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === row.id ? { ...u, status: nextStatusDisplay } : u
          )
        );
        showToast(`User ${row.name} is now ${nextStatusDisplay}`, "info");
      } catch (err) {
        showToast(err.message || "Failed to update user status", "error");
      }
    },
    [currentAdmin, showToast]
  );

  const handleDeleteUser = useCallback(
    async (row) => {
      const isSelf =
        currentAdmin &&
        (currentAdmin.id === row.id || currentAdmin.email === row.email);
      if (isSelf) {
        showToast("You cannot delete your own admin account.", "error");
        return;
      }
      if ((row.role || "").toLowerCase() === "admin") {
        showToast("Admin accounts cannot be deleted.", "error");
        return;
      }

      if (
        !window.confirm(
          `Are you sure you want to remove user "${row.name}" (${row.email})? This action preserves master services and cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await apiClient.delete(`/admin/users/${row.id}`);
        setUsers((prev) => prev.filter((u) => u.id !== row.id));
        showToast(`User ${row.name} removed successfully`, "info");
      } catch (err) {
        showToast(err.message || "Failed to delete user", "error");
      }
    },
    [currentAdmin, showToast]
  );

  const handleViewDetails = async (row) => {
    setDetailsLoading(true);
    setSelectedUserDetails(row);
    try {
      const res = await apiClient.get(`/admin/users/${row.id}`);
      if (res && res.success && res.data) {
        setSelectedUserDetails(res.data);
      }
    } catch (err) {
      console.warn("Could not load extended details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formattedFilterOptions = [
    { value: "All", label: "All Roles" },
    ...filterOptions
      .filter((r) => r.toLowerCase() !== "all")
      .map((r) => ({
        value: r,
        label: r.charAt(0).toUpperCase() + r.slice(1),
      })),
  ];

  return (
    <Layout title={t("manageUsers")}>
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by name, email, or phone..."
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        filterOptions={formattedFilterOptions}
        isSearching={isSearching}
        totalCount={users.length}
        filteredCount={finalFiltered.length}
        actions={
          <div className="flex-row items-center gap-2">
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card-bg, #ffffff)",
                color: "inherit",
                fontSize: 13,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        }
      />

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : (
        <>
          <DataTable
            columns={COLUMNS}
            rows={paginated}
            renderActions={(row) => {
              const isSelf =
                currentAdmin &&
                (currentAdmin.id === row.id ||
                  currentAdmin.email === row.email);
              const isAdminUser =
                (row.role || "").toLowerCase() === "admin";
              const isActive =
                (row.status || "").toLowerCase() === "active";

              return (
                <div
                  className="card-actions-row"
                  style={{ flexWrap: "nowrap" }}
                >
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleViewDetails(row)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      background: "var(--surface, #f1f5f9)",
                      color: "inherit",
                    }}
                    title="View user details"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className={`btn btn-sm ${
                      isActive ? "btn-danger" : "btn-primary"
                    }`}
                    onClick={() => handleToggleStatus(row)}
                    disabled={isSelf || isAdminUser}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      ...(isSelf || isAdminUser
                        ? { opacity: 0.5, cursor: "not-allowed" }
                        : {}),
                    }}
                    title={
                      isSelf
                        ? "Cannot suspend yourself"
                        : isAdminUser
                        ? "Admin accounts cannot be suspended"
                        : isActive
                        ? "Suspend account"
                        : "Reactivate account"
                    }
                  >
                    {isActive ? "Suspend" : "Activate"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleDeleteUser(row)}
                    disabled={isSelf || isAdminUser}
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      color: "var(--danger, #dc2626)",
                      border: "1px solid var(--danger-border, #fca5a5)",
                      background: "transparent",
                      ...(isSelf || isAdminUser
                        ? { opacity: 0.4, cursor: "not-allowed" }
                        : {}),
                    }}
                    title={
                      isSelf
                        ? "Cannot delete yourself"
                        : isAdminUser
                        ? "Admin accounts cannot be deleted"
                        : "Remove user"
                    }
                  >
                    ✕
                  </button>
                </div>
              );
            }}
          />

          {totalPages > 1 && (
            <div
              className="flex-row items-center justify-center gap-3"
              style={{ marginTop: 18 }}
            >
              <button
                type="button"
                className="btn"
                onClick={prevPage}
                disabled={!hasPrev}
              >
                ← Previous
              </button>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn"
                onClick={nextPage}
                disabled={!hasNext}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* User Details Modal */}
      {selectedUserDetails && (
        <Modal
          title={`User Profile: ${selectedUserDetails.name || "User Details"}`}
          onClose={() => setSelectedUserDetails(null)}
          width={560}
        >
          {detailsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
              Loading user details...
            </div>
          ) : (
            <div className="flex-column gap-3" style={{ fontSize: 13.5 }}>
              {/* Header Badges */}
              <div className="flex-row flex-wrap items-center gap-2">
                <Badge status={selectedUserDetails.status || "Active"} />
                <span
                  style={{
                    fontSize: 11.5,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--brand-primary, #3b82f6)",
                    color: "#fff",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {selectedUserDetails.role}
                </span>
                {selectedUserDetails.wallet && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--surface, #f8fafc)",
                      border: "1px solid var(--border)",
                      color: "var(--success, #16a34a)",
                      fontWeight: 600,
                    }}
                  >
                    Wallet: ₹{selectedUserDetails.wallet.balance ?? 0}
                  </span>
                )}
              </div>

              {/* Personal Information */}
              <div
                className="form-row-2col"
                style={{
                  background: "var(--surface, #f8fafc)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Email</strong>
                  <span>{selectedUserDetails.email}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Phone</strong>
                  <span>{selectedUserDetails.phone || "—"}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Address</strong>
                  <span>{selectedUserDetails.address || "—"}</span>
                </div>
                <div>
                  <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>City</strong>
                  <span>{selectedUserDetails.city || "—"}</span>
                </div>
              </div>

              {/* Provider Profile Details */}
              {selectedUserDetails.providerProfile && (
                <div
                  className="flex-column gap-2"
                  style={{
                    background: "var(--surface, #f8fafc)",
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <strong style={{ color: "var(--brand-primary, #2563eb)", fontSize: 13 }}>
                    Provider Profile
                  </strong>
                  <div className="form-row-2col">
                    <div>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Business Name</strong>
                      <span>{selectedUserDetails.providerProfile.business_name || "—"}</span>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Category</strong>
                      <span>{selectedUserDetails.providerProfile.category || "—"}</span>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Hourly Rate</strong>
                      <span>₹{selectedUserDetails.providerProfile.hourly_rate || 0}/hr</span>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Rating & Reviews</strong>
                      <span>⭐ {selectedUserDetails.providerProfile.rating || 0} ({selectedUserDetails.providerProfile.review_count || 0} reviews)</span>
                    </div>
                  </div>

                  {selectedUserDetails.providerProfile.bio && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>Bio</strong>
                      <p style={{ margin: "2px 0 0", color: "var(--foreground)", fontSize: 12.5 }}>
                        {selectedUserDetails.providerProfile.bio}
                      </p>
                    </div>
                  )}

                  {selectedUserDetails.providerProfile.servicesOffered?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>
                        Linked Master Services
                      </strong>
                      <div className="flex-row flex-wrap gap-2">
                        {selectedUserDetails.providerProfile.servicesOffered.map((svc) => (
                          <span
                            key={svc.id}
                            style={{
                              fontSize: 11.5,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(59, 130, 246, 0.1)",
                              color: "var(--brand-primary, #2563eb)",
                              border: "1px solid rgba(59, 130, 246, 0.2)",
                            }}
                          >
                            {svc.title} (₹{svc.price})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Booking Statistics */}
              {selectedUserDetails.stats && (
                <div className="stats-grid-4col">
                  <div style={{ padding: "8px 4px", background: "var(--surface, #f8fafc)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{selectedUserDetails.stats.totalBookings}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Total</div>
                  </div>
                  <div style={{ padding: "8px 4px", background: "var(--surface, #f8fafc)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--primary, #3b82f6)" }}>{selectedUserDetails.stats.activeBookings}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Active</div>
                  </div>
                  <div style={{ padding: "8px 4px", background: "var(--surface, #f8fafc)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--success, #16a34a)" }}>{selectedUserDetails.stats.completedBookings}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Completed</div>
                  </div>
                  <div style={{ padding: "8px 4px", background: "var(--surface, #f8fafc)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--danger, #dc2626)" }}>{selectedUserDetails.stats.cancelledBookings}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Cancelled</div>
                  </div>
                </div>
              )}

              {/* Close Action */}
              <div className="flex-row justify-end" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSelectedUserDetails(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
}

export default ManageUsers;
