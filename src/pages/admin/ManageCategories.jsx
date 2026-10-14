import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useServices } from "../../hooks/useServices";
import { useSearch } from "../../hooks/useSearch";
import { formatCurrency } from "../../utils/currency";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import FilterBar from "../../components/common/FilterBar";

const COLUMNS = [
  { key: "name", label: "Category Name" },
  { key: "description", label: "Description" },
  { key: "count", label: "Services Listed" },
  { key: "status", label: "Status" },
];

const SERVICE_COLUMNS = [
  { key: "name", label: "Service Name" },
  { key: "provider", label: "Provider" },
  { key: "category", label: "Category" },
  { key: "formattedPrice", label: "Price" },
  { key: "status", label: "Status" },
];

function ManageCategories() {
  const { t } = useTranslation();
  const {
    categories,
    services,
    loading,
    addCategory,
    deleteCategory,
    toggleServiceStatus,
  } = useServices();

  const [newCategory, setNewCategory] = useState("");
  const [searchParams] = useSearchParams();

  // Compute live service count per category
  const categoriesWithCounts = categories.map((c) => ({
    ...c,
    count: services.filter((s) => s.category?.toLowerCase() === c.name?.toLowerCase()).length,
    status: c.status || "Active",
  }));

  const { query, setQuery, results, isSearching } = useSearch(categoriesWithCounts, {
    keys: ["name", "description"],
    initialQuery: searchParams.get("q") || "",
  });

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    addCategory(newCategory.trim());
    setNewCategory("");
  };

  const formattedServices = services.map((s) => ({
    ...s,
    formattedPrice: formatCurrency(s.price),
  }));

  return (
    <Layout title={t("manageCategories")}>
      <form onSubmit={handleAddCategory} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          className="text-input"
          style={{ width: 280 }}
          placeholder="New category name"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          + Add Category
        </button>
      </form>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search categories..."
        isSearching={isSearching}
        totalCount={categories.length}
        filteredCount={results.length}
      />

      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={results}
          renderActions={(row) => (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCategory(row.id)}>
              Delete
            </button>
          )}
        />
      )}

      <h3 style={{ marginTop: 36 }}>Platform Services Catalog</h3>
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
        Every service listed across all providers. Deactivating a listing immediately hides it from the customer service browser.
      </p>

      {loading ? (
        <Skeleton variant="table" count={4} />
      ) : (
        <DataTable
          columns={SERVICE_COLUMNS}
          rows={formattedServices}
          renderActions={(row) => (
            <button
              type="button"
              className={`btn btn-sm ${row.status === "Active" ? "btn-danger" : "btn-primary"}`}
              onClick={() => toggleServiceStatus(row.id)}
            >
              {row.status === "Active" ? "Deactivate" : "Activate"}
            </button>
          )}
        />
      )}
    </Layout>
  );
}

export default ManageCategories;
