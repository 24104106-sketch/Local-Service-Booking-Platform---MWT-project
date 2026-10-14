import { useContext, useState, useMemo } from "react";
import { NotificationContext } from "../../context/NotificationContext";
import { useSearch } from "../../hooks/useSearch";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import FilterBar from "../../components/common/FilterBar";

const COLUMNS = [
  { key: "recipient", label: "User" },
  { key: "title", label: "Event" },
  { key: "body", label: "Details" },
];

const READ_OPTIONS = ["All", "Unread", "Read"];

function SystemLogs() {
  const { notifications, hydrated } = useContext(NotificationContext);
  const [readFilter, setReadFilter] = useState("All");

  const { query, setQuery, results, isSearching } = useSearch(notifications, {
    keys: ["recipient", "title", "body"],
  });

  const visible = useMemo(
    () => (readFilter === "All" ? results : results.filter((n) => (readFilter === "Unread" ? n.unread : !n.unread))),
    [results, readFilter]
  );

  return (
    <Layout title="System Logs">
      <p className="page-intro">Every platform event, across every user — bookings, complaints, chat and admin broadcasts.</p>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by user, event, or detail..."
        filterValue={readFilter}
        onFilterChange={setReadFilter}
        filterOptions={READ_OPTIONS}
        isSearching={isSearching}
        totalCount={notifications.length}
        filteredCount={visible.length}
      />

      {!hydrated ? (
        <Skeleton variant="table" count={6} />
      ) : (
        <DataTable columns={COLUMNS} rows={visible} />
      )}
    </Layout>
  );
}

export default SystemLogs;
