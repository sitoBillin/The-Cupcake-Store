import { Fragment } from "react";
import type { ChartRow } from "../api/chartmuseum";
import type { SortDir, SortKey } from "../charts/types";
import { ChartDetailPanel } from "./ChartDetailPanel";
import { DetailEyeIcon } from "./DetailEyeIcon";
import { SortableTh } from "./SortableTh";
import { formatFriendlyDate } from "../utils/formatFriendlyDate";

type Props = {
  loading: boolean;
  rowsCount: number;
  filteredCount: number;
  pageRows: ChartRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSortClick: (key: SortKey) => void;
  expandedRowKey: string | null;
  onToggleRow: (rowKey: string) => void;
  deletingKey: string | null;
  onRequestDelete: (row: ChartRow) => void;
};

function rowKey(row: ChartRow) {
  return `${row.chartName}@${row.version}`;
}

export function ChartTable({
  loading,
  rowsCount,
  filteredCount,
  pageRows,
  sortKey,
  sortDir,
  onSortClick,
  expandedRowKey,
  onToggleRow,
  deletingKey,
  onRequestDelete,
}: Props) {
  const tableMuted = loading && rowsCount > 0;
  const showEmptyNoResults = !loading && filteredCount === 0;
  const showLoadingSkeleton = loading && rowsCount === 0;

  return (
    <div
      className={`table-wrap${tableMuted ? " table-wrap--muted" : ""}`}
    >
      <table className="chart-table">
        <thead>
          <tr>
            <SortableTh
              label="Chart"
              sortKey="chartName"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={onSortClick}
              className="col-chart"
            />
            <SortableTh
              label="Versión"
              sortKey="version"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={onSortClick}
              className="col-version"
            />
            <SortableTh
              label="Creado"
              sortKey="created"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={onSortClick}
            />
            <th
              scope="col"
              className="col-expand th-static"
              aria-label="Ver detalle"
            >
              <span className="th-expand-icon-wrap" aria-hidden="true">
                <DetailEyeIcon expanded={false} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {showEmptyNoResults ? (
            <tr>
              <td colSpan={4} className="empty">
                No hay resultados con los filtros actuales.
              </td>
            </tr>
          ) : null}
          {showLoadingSkeleton ? (
            <tr>
              <td colSpan={4} className="empty">
                Cargando datos del repositorio…
              </td>
            </tr>
          ) : null}
          {pageRows.map((row) => {
            const key = rowKey(row);
            const expanded = expandedRowKey === key;
            const panelId = `chart-detail-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            return (
              <Fragment key={key}>
                <tr
                  className={
                    expanded ? "chart-row chart-row--open" : "chart-row"
                  }
                >
                  <td className="td-chart-name">{row.chartName}</td>
                  <td className="td-version">
                    <span className="table-version-badge mono">
                      {row.version}
                    </span>
                  </td>
                  <td className="muted td-created">
                    {row.created ? formatFriendlyDate(row.created) : "—"}
                  </td>
                  <td className="td-expand">
                    <button
                      type="button"
                      className="btn-expand"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => onToggleRow(key)}
                    >
                      <DetailEyeIcon expanded={expanded} />
                      <span className="sr-only">
                        {expanded
                          ? "Ocultar detalle"
                          : "Mostrar detalle y acciones"}
                      </span>
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="chart-row-detail">
                    <td colSpan={4}>
                      <ChartDetailPanel
                        row={row}
                        panelId={panelId}
                        deleteDisabled={deletingKey !== null}
                        onRequestDelete={() => onRequestDelete(row)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
