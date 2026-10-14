import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useComplaints } from "../../hooks/useComplaints";
import { useSearch } from "../../hooks/useSearch";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import FilterBar from "../../components/common/FilterBar";

const COLUMNS = [
  { key: "id", label: "Complaint ID" },
  { key: "raisedBy", label: "Raised By" },
  { key: "type", label: "Type" },
  { key: "against", label: "Against Provider" },
  { key: "date", label: "Date" },
  { key: "status", label: "Status" },
];

const STATUS_OPTIONS = ["All", "Open", "In Review", "Resolved"];

function Complaints() {
  const { t } = useTranslation();
  const { complaints, loading, markInReview, resolveComplaint } = useComplaints();
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchParams] = useSearchParams();

  const { query, setQuery, results, isSearching } = useSearch(complaints, {
    keys: ["raisedBy", "type", "against"],
    initialQuery: searchParams.get("q") || "",
  });

  const visible = useMemo(
    () => (statusFilter === "All" ? results : results.filter((c) => c.status === statusFilter)),
    [results, statusFilter]
  );

  return (
    <Layout title={t("complaints")}>
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by customer, type, provider..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={STATUS_OPTIONS}
        isSearching={isSearching}
        totalCount={(complaints || []).length}
        filteredCount={visible.length}
      />

      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="📢"
          title={query || statusFilter !== "All" ? "No matching complaints" : "No complaints raised"}
          message={query || statusFilter !== "All" ? "Try a different search or filter." : "Complaints raised by customers will appear here."}
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={visible}
          renderActions={(row) => (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {row.status === "Open" && (
                <button type="button" className="btn btn-sm" onClick={() => markInReview(row.id)}>
                  Mark In Review
                </button>
              )}
              {row.status !== "Resolved" ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => resolveComplaint(row.id)}>
                  Mark Resolved
                </button>
              ) : (
                <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>Closed</span>
              )}
            </div>
          )}
        />
      )}
    </Layout>
  );
}

export default Complaints;
