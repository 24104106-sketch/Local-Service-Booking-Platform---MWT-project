import Badge from "./Badge";

/**
 * Generic table. `columns` = [{ key, label }], `rows` = array of objects.
 * If a cell value looks like a status (see STATUS_KEYS), it renders as a Badge.
 * `renderActions(row)` is optional — return JSX for an actions cell.
 */
const STATUS_KEYS = ["status", "paymentStatus"];

function DataTable({ columns, rows, renderActions }) {
  return (
    // Horizontal scroll wrapper — on narrow screens the table can be wider
    // than the viewport (many columns + actions); this lets it scroll
    // instead of overflowing the page or squashing every column unreadably.
    <div className="data-table-scroll">
      <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
          {renderActions && <th>Action</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id || i}>
            {columns.map((col) => (
              <td key={col.key}>
                {STATUS_KEYS.includes(col.key) ? (
                  <Badge status={row[col.key]} />
                ) : (
                  row[col.key]
                )}
              </td>
            ))}
            {renderActions && <td>{renderActions(row)}</td>}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (renderActions ? 1 : 0)} style={{ textAlign: "center", color: "var(--faint)", padding: "28px 16px" }}>
              No records found.
            </td>
          </tr>
        )}
      </tbody>
      </table>
    </div>
  );
}

export default DataTable;
