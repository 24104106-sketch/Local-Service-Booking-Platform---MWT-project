import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useBookings } from "../../hooks/useBookings";
import { usePagination } from "../../hooks/usePagination";
import { useSearch } from "../../hooks/useSearch";
import { formatCurrency, parseAmount } from "../../utils/currency";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import FilterBar from "../../components/common/FilterBar";

const COLUMNS = [
  { key: "id", label: "Booking ID" },
  { key: "customer", label: "Customer" },
  { key: "provider", label: "Provider" },
  { key: "service", label: "Service" },
  { key: "date", label: "Date" },
  { key: "formattedAmount", label: "Amount" },
  { key: "status", label: "Status" },
];

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Confirmed",
  "On The Way",
  "Arrived",
  "Service Started",
  "Completed",
  "Cancelled",
  "Rejected",
];

const PAGE_SIZE = 5;

function AllBookings() {
  const { t } = useTranslation();
  const { bookings, loading } = useBookings();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("All");

  const formattedBookings = useMemo(() => {
    return (bookings || []).map((b) => ({
      ...b,
      formattedAmount: formatCurrency(parseAmount(b.amount)),
    }));
  }, [bookings]);

  const statusFiltered = useMemo(
    () => (statusFilter === "All" ? formattedBookings : formattedBookings.filter((b) => b.status === statusFilter)),
    [formattedBookings, statusFilter]
  );

  const { query, setQuery, results: visible, isSearching } = useSearch(statusFiltered, {
    keys: ["id", "customer", "provider", "service"],
    initialQuery: searchParams.get("q") || "",
  });

  const { page, totalPages, paginated, nextPage, prevPage, hasNext, hasPrev } = usePagination(visible, PAGE_SIZE);

  return (
    <Layout title={t("allBookings")}>
      <p className="page-intro">Every booking across the platform — customers, providers, status and amount.</p>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by id, customer, provider, service..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={STATUS_OPTIONS}
        isSearching={isSearching}
        totalCount={bookings.length}
        filteredCount={visible.length}
      />

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : (
        <>
          <DataTable columns={COLUMNS} rows={paginated} />

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18 }}>
              <button type="button" className="btn" onClick={prevPage} disabled={!hasPrev}>
                ← Previous
              </button>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button type="button" className="btn" onClick={nextPage} disabled={!hasNext}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export default AllBookings;
