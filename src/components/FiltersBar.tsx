import type { ChartRow } from "../api/chartmuseum";
import {
  buildChartSelectOrdered,
  chartSelectOptionLabel,
  chartSelectOptionValue,
} from "../charts/selectOptions";
import { uniqueChartNames } from "../charts/sortAndFilter";

type Props = {
  rows: ChartRow[];
  loading: boolean;
  chartNameFilter: string;
  onChartNameFilterChange: (value: string) => void;
  textFilter: string;
  onTextFilterChange: (value: string) => void;
  onClearFilters: () => void;
  clearFiltersDisabled: boolean;
  totalFiltered: number;
  rangeFrom: number;
  rangeTo: number;
};

export function FiltersBar({
  rows,
  loading,
  chartNameFilter,
  onChartNameFilterChange,
  textFilter,
  onTextFilterChange,
  onClearFilters,
  clearFiltersDisabled,
  totalFiltered,
  rangeFrom,
  rangeTo,
}: Props) {
  const chartOptions = uniqueChartNames(rows);
  const chartSelectOrdered = buildChartSelectOrdered(chartOptions);

  return (
    <section className="filters" aria-label="Filtros y ordenación">
      <div className="filters-grid">
        <label className="field">
          <span className="field-label">Chart</span>
          <select
            value={chartNameFilter}
            onChange={(e) => onChartNameFilterChange(e.target.value)}
            disabled={loading && rows.length === 0}
            aria-label="Filtrar por nombre de chart"
          >
            <option value="">Todos los charts</option>
            {chartSelectOrdered.map((name) => {
              const value = chartSelectOptionValue(name);
              return (
                <option key={value + name} value={value}>
                  {chartSelectOptionLabel(name)}
                </option>
              );
            })}
          </select>
        </label>
        <label className="field field-grow">
          <span className="field-label">Buscar en texto</span>
          <input
            type="search"
            value={textFilter}
            onChange={(e) => onTextFilterChange(e.target.value)}
            placeholder="Versión, descripción o cualquier coincidencia…"
            autoComplete="off"
            aria-label="Buscar en versión y descripción"
          />
        </label>
        <div className="field field-actions">
          <span className="field-label ghost" aria-hidden="true">
            .
          </span>
          <button
            type="button"
            className="btn secondary btn-block"
            onClick={onClearFilters}
            disabled={clearFiltersDisabled}
          >
            Limpiar filtros
          </button>
        </div>
      </div>
      <div className="pagination-toolbar">
        <p className="meta">
          {loading && rows.length === 0
            ? "Cargando…"
            : loading
              ? `Actualizando… · ${totalFiltered} de ${rows.length} versiones visibles`
              : `${totalFiltered} de ${rows.length} versiones · ${chartOptions.length} charts`}
        </p>
      </div>
      {totalFiltered > 0 && (!loading || rows.length > 0) ? (
        <p className="meta meta-range" aria-live="polite">
          Mostrando {rangeFrom}–{rangeTo} de {totalFiltered}
        </p>
      ) : null}
    </section>
  );
}
