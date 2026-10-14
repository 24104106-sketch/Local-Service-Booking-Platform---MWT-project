/**
 * Unified FilterBar Component
 * Consolidates search input, category/status filter dropdown, count indicators, and action buttons.
 */
function FilterBar({
  query = "",
  onQueryChange,
  placeholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions = [],
  isSearching = false,
  totalCount,
  filteredCount,
  onReset,
  actions,
  style,
}) {
  const showReset =
    typeof onReset === "function" &&
    (Boolean(query) || (filterValue !== undefined && filterValue !== "All" && filterValue !== ""));

  return (
    <div
      className="filter-bar"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        marginBottom: 20,
        flexWrap: "wrap",
        justifyContent: "space-between",
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "1 1 320px", flexWrap: "wrap" }}>
        {typeof onQueryChange === "function" && (
          <div className="search-box" style={{ flex: "1 1 220px", minWidth: 200, maxWidth: 360 }}>
            <span style={{ opacity: 0.6, fontSize: 13 }}>🔍</span>
            <input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                width: "100%",
                font: "inherit",
                color: "inherit",
              }}
            />
          </div>
        )}

        {Array.isArray(filterOptions) && filterOptions.length > 0 && typeof onFilterChange === "function" && (
          <select
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            style={{ minWidth: 130, padding: "8px 12px" }}
          >
            {filterOptions.map((opt) => {
              const val = typeof opt === "object" ? opt.value : opt;
              const label = typeof opt === "object" ? opt.label : opt;
              return (
                <option key={val} value={val}>
                  {label}
                </option>
              );
            })}
          </select>
        )}

        {showReset && (
          <button type="button" className="btn btn-sm" onClick={onReset}>
            Reset
          </button>
        )}

        {isSearching && (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Searching...</span>
        )}

        {typeof filteredCount === "number" && typeof totalCount === "number" && (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>

      {actions && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
