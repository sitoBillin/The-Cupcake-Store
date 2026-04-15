import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./App.css";
import {
  deleteChartVersion,
  fetchCharts,
  type ChartRow,
} from "./api/chartmuseum";

type SortKey = "chartName" | "version" | "created";

const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

function uniqueChartNames(rows: ChartRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    set.add(r.chartName);
  }
  return [...set].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function compareRows(
  a: ChartRow,
  b: ChartRow,
  key: SortKey,
  dir: "asc" | "desc",
): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "created") {
    const ta = a.created ? Date.parse(a.created) : NaN;
    const tb = b.created ? Date.parse(b.created) : NaN;
    const va = Number.isNaN(ta) ? -Infinity : ta;
    const vb = Number.isNaN(tb) ? -Infinity : tb;
    if (va < vb) return -1 * mul;
    if (va > vb) return 1 * mul;
    return 0;
  }
  if (key === "chartName") {
    return (
      mul *
      a.chartName.localeCompare(b.chartName, undefined, { sensitivity: "base" })
    );
  }
  return (
    mul *
    a.version.localeCompare(b.version, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

/** Versión más reciente primero (semver con segmentos numéricos). */
function compareSemverDesc(va: string, vb: string): number {
  return vb.localeCompare(va, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRows(
  rows: ChartRow[],
  key: SortKey,
  dir: "asc" | "desc",
): ChartRow[] {
  return [...rows].sort((a, b) => {
    const c = compareRows(a, b, key, dir);
    if (c !== 0) return c;
    const byName = a.chartName.localeCompare(b.chartName, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    return compareSemverDesc(a.version, b.version);
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Solo estos charts en el panel lateral de novedades. */
const RECENT_SIDEBAR_CHARTS = ["tortilla", "gofre", "gofrera"] as const;

function allowedRecentChartName(
  chartName: string,
  allowed: readonly string[],
): boolean {
  const n = chartName.trim().toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase() === n);
}

function DetailEyeIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={
        expanded ? "detail-eye-svg detail-eye-svg--expanded" : "detail-eye-svg"
      }
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="detail-eye-lid"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        className="detail-eye-iris"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

/** Por chart: versión más reciente por `created` y la inmediatamente anterior por fecha. */
type ChartLatestSummary = {
  displayName: string;
  latest: ChartRow;
  previous?: ChartRow;
};

function buildLatestPerChartByDate(rows: ChartRow[]): ChartLatestSummary[] {
  const byKey = new Map<string, ChartRow[]>();
  for (const r of rows) {
    if (!r.created || Number.isNaN(Date.parse(r.created))) continue;
    const key = r.chartName.trim().toLowerCase();
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = [];
      byKey.set(key, bucket);
    }
    bucket.push(r);
  }
  for (const arr of byKey.values()) {
    arr.sort((a, b) => {
      const db = Date.parse(b.created!);
      const da = Date.parse(a.created!);
      if (db !== da) return db - da;
      return compareSemverDesc(a.version, b.version);
    });
  }

  const summaries: ChartLatestSummary[] = [];
  for (const arr of byKey.values()) {
    if (arr.length === 0) continue;
    summaries.push({
      displayName: arr[0].chartName,
      latest: arr[0],
      previous: arr[1],
    });
  }

  const byLower = new Map(
    summaries.map((s) => [s.latest.chartName.trim().toLowerCase(), s]),
  );
  const ordered: ChartLatestSummary[] = [];
  for (const name of RECENT_SIDEBAR_CHARTS) {
    const s = byLower.get(name);
    if (s) ordered.push(s);
  }
  const rest = summaries
    .filter(
      (s) =>
        !allowedRecentChartName(s.latest.chartName, [...RECENT_SIDEBAR_CHARTS]),
    )
    .sort(
      (a, b) => Date.parse(b.latest.created!) - Date.parse(a.latest.created!),
    );
  ordered.push(...rest);
  return ordered;
}

function App() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [chartNameFilter, setChartNameFilter] = useState("tortilla");
  const [textFilter, setTextFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("chartName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChartRow | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchCharts();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los charts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chartOptions = useMemo(() => uniqueChartNames(rows), [rows]);

  /** Orden del desplegable: tortilla, gofre, gofrera y el resto alfabético. */
  const chartSelectOrdered = useMemo(() => {
    const tail = chartOptions
      .filter((n) => !allowedRecentChartName(n, [...RECENT_SIDEBAR_CHARTS]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [...RECENT_SIDEBAR_CHARTS, ...tail];
  }, [chartOptions]);

  useEffect(() => {
    if (chartOptions.length === 0 || !chartNameFilter) return;
    const lower = chartNameFilter.trim().toLowerCase();
    const inApi = chartOptions.some((n) => n.trim().toLowerCase() === lower);
    const isPriority = [...RECENT_SIDEBAR_CHARTS].some((p) => p === lower);
    if (!inApi && !isPriority) {
      setChartNameFilter("tortilla");
    }
  }, [chartOptions, chartNameFilter]);

  const filteredSorted = useMemo(() => {
    let list = rows;

    if (chartNameFilter) {
      const cf = chartNameFilter.trim().toLowerCase();
      list = list.filter((r) => r.chartName.trim().toLowerCase() === cf);
    }

    const q = textFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob =
          `${r.chartName} ${r.version} ${r.description}`.toLowerCase();
        return blob.includes(q);
      });
    }

    return sortRows(list, sortKey, sortDir);
  }, [rows, chartNameFilter, textFilter, sortKey, sortDir]);

  const totalFiltered = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  const rangeFrom = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, totalFiltered);

  const recentChartSummaries = useMemo(
    () => buildLatestPerChartByDate(rows),
    [rows],
  );

  useEffect(() => {
    setExpandedRowKey(null);
  }, [page, pageSize, chartNameFilter, textFilter, sortKey, sortDir]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPendingDelete(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete]);

  useEffect(() => {
    if (!pendingDelete) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pendingDelete]);

  const onSortClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" ? "desc" : "asc");
    }
  };

  const clearFilters = () => {
    setChartNameFilter("tortilla");
    setTextFilter("");
  };

  function openDeleteModal(row: ChartRow) {
    setPendingDelete(row);
  }

  async function confirmDeleteFromModal() {
    if (!pendingDelete) return;
    const row = pendingDelete;
    const key = `${row.chartName}@${row.version}`;
    setDeletingKey(key);
    setError(null);
    try {
      await deleteChartVersion(row.chartName, row.version);
      setPendingDelete(null);
      setExpandedRowKey((k) => (k === key ? null : k));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingKey(null);
    }
  }

  function toggleRowExpanded(key: string) {
    setExpandedRowKey((k) => (k === key ? null : key));
  }

  const hasActiveFilters = Boolean(
    textFilter.trim() || chartNameFilter.trim().toLowerCase() !== "tortilla",
  );

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-logo"
            src="/cupcake-logo.svg"
            width={104}
            height={104}
            alt=""
            decoding="async"
          />
          <div className="brand-text">
            <h1>The Cupcake Store</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualizar
        </button>
      </header>

      <div className="app-layout">
        <div className="app-main">
          <section className="filters" aria-label="Filtros y ordenación">
            <div className="filters-grid">
              <label className="field">
                <span className="field-label">Chart</span>
                <select
                  value={chartNameFilter}
                  onChange={(e) => setChartNameFilter(e.target.value)}
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
                  onChange={(e) => setTextFilter(e.target.value)}
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
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
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

          {error ? (
            <div className="alert error" role="alert">
              {error}
              <p className="hint">
                Comprueba{" "}
                <code className="inline-code">CHARTMUSEUM_BASE_URL</code> y
                credenciales en <code className="inline-code">.env</code>, y
                reinicia <code className="inline-code">npm run dev</code>.
              </p>
            </div>
          ) : null}

          <div
            className={`table-wrap${loading && rows.length > 0 ? " table-wrap--muted" : ""}`}
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
                {!loading && filteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No hay resultados con los filtros actuales.
                    </td>
                  </tr>
                ) : null}
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      Cargando datos del repositorio…
                    </td>
                  </tr>
                ) : null}
                {pageRows.map((row) => {
                  const key = `${row.chartName}@${row.version}`;
                  const expanded = expandedRowKey === key;
                  const panelId = `chart-detail-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  return (
                    <Fragment key={key}>
                      <tr className={expanded ? "chart-row chart-row--open" : "chart-row"}>
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
                            onClick={() => toggleRowExpanded(key)}
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
                            <div className="chart-detail-panel" id={panelId}>
                              <div className="chart-detail-layout">
                                <section className="chart-detail-section chart-detail-section--wide">
                                  <h3 className="chart-detail-heading">
                                    Descripción
                                  </h3>
                                  <p className="chart-detail-body">
                                    {row.description?.trim()
                                      ? row.description
                                      : "Sin descripción en el índice."}
                                  </p>
                                </section>

                                <div className="chart-detail-tiles">
                                  {row.created ? (
                                    <section className="chart-detail-section chart-detail-tile">
                                      <h3 className="chart-detail-heading">
                                        Publicado
                                      </h3>
                                      <p className="chart-detail-body chart-detail-body--emph">
                                        {formatFriendlyDate(row.created)}
                                      </p>
                                      <p className="chart-detail-meta mono">
                                        {row.created}
                                      </p>
                                    </section>
                                  ) : null}
                                  {row.home ? (
                                    <section className="chart-detail-section chart-detail-tile">
                                      <h3 className="chart-detail-heading">
                                        Home
                                      </h3>
                                      <p className="chart-detail-body">
                                        <a
                                          href={row.home}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="chart-detail-link"
                                        >
                                          {row.home}
                                        </a>
                                      </p>
                                    </section>
                                  ) : null}
                                  {row.digest ? (
                                    <section className="chart-detail-section chart-detail-tile chart-detail-tile--digest">
                                      <h3 className="chart-detail-heading">
                                        Digest
                                      </h3>
                                      <p className="chart-detail-body mono chart-detail-digest">
                                        {row.digest}
                                      </p>
                                    </section>
                                  ) : null}
                                </div>

                                {row.urls && row.urls.length > 0 ? (
                                  <section className="chart-detail-section chart-detail-section--wide">
                                    <h3 className="chart-detail-heading">
                                      URLs del paquete
                                    </h3>
                                    <ul className="chart-detail-url-list">
                                      {row.urls.map((u) => (
                                        <li key={u}>
                                          <a
                                            href={u}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="chart-detail-link"
                                          >
                                            {u}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  </section>
                                ) : null}
                              </div>
                              <div className="chart-detail-actions">
                                <button
                                  type="button"
                                  className="btn danger"
                                  disabled={deletingKey !== null}
                                  onClick={() => openDeleteModal(row)}
                                >
                                  Eliminar esta versión…
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bottom-row">
            <nav
              className="pagination-nav pagination-nav--inline"
              aria-label="Paginación de resultados"
            >
              {totalFiltered > 0 && totalPages > 1 ? (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="pagination-status">
                    Página <strong>{page}</strong> de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </button>
                </>
              ) : null}
            </nav>
            <label className="field field-inline field-page-size field-page-size-bottom">
              <span className="field-label">Por página</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value) as PageSize;
                  setPageSize(n);
                  setPage(1);
                }}
                disabled={loading && rows.length === 0}
                aria-label="Número de filas por página"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <aside className="app-sidebar" aria-label="Publicaciones recientes">
          <div className="recent-panel">
            <h2 className="recent-title">Últimas publicaciones</h2>
            {loading && rows.length === 0 ? (
              <p className="recent-empty">Cargando…</p>
            ) : recentChartSummaries.length === 0 ? (
              <p className="recent-empty">
                No hay datos con fecha de creación (
                <code className="inline-code">created</code>) para agrupar por
                chart. Cuando ChartMuseum lo envíe, aquí verás la última versión
                publicada y la anterior por fecha.
              </p>
            ) : (
              <ol className="recent-list">
                {recentChartSummaries.map((pair) => {
                  const k = `${pair.latest.chartName}@${pair.latest.version}`;
                  return (
                    <li key={k} className="recent-item">
                      <div className="recent-item-head">
                        <span
                          className="recent-chart-name"
                          title={pair.displayName}
                        >
                          {pair.displayName}
                        </span>
                        <span
                          className="recent-version-badge mono"
                          title={`Versión ${pair.latest.version}`}
                        >
                          {pair.latest.version}
                        </span>
                      </div>
                      <time
                        className="recent-item-date"
                        dateTime={pair.latest.created}
                      >
                        {formatFriendlyDate(pair.latest.created!)}
                      </time>
                      {pair.previous ? (
                        <div className="recent-previous">
                          <span className="recent-previous-label">
                            Anterior por fecha
                          </span>
                          <div className="recent-previous-body">
                            <time
                              className="recent-previous-date"
                              dateTime={pair.previous.created}
                              title={formatFriendlyDate(pair.previous.created!)}
                            >
                              {formatFriendlyDate(pair.previous.created!)}
                            </time>
                            <span
                              className="recent-previous-badge mono"
                              title={`Versión ${pair.previous.version}`}
                            >
                              {pair.previous.version}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="recent-previous-none">
                          Sin otra versión con fecha en el historial
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>

      {pendingDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!deletingKey) setPendingDelete(null);
          }}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-modal-title" className="modal-title">
              Confirmar eliminación
            </h2>
            <p className="modal-body">
              Se eliminará del ChartMuseum la versión{" "}
              <strong className="mono">{pendingDelete.version}</strong> del chart{" "}
              <strong>{pendingDelete.chartName}</strong>. Esta acción no se puede
              deshacer.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={deletingKey !== null}
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={deletingKey !== null}
                aria-busy={deletingKey !== null}
                onClick={() => void confirmDeleteFromModal()}
              >
                {deletingKey !== null ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SortableTh(props: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const { label, sortKey, currentKey, currentDir, onSort, className } = props;
  const active = sortKey === currentKey;
  const ariaSort = active
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const thClass = ["th-sort", className].filter(Boolean).join(" ");

  return (
    <th scope="col" aria-sort={ariaSort} className={thClass}>
      <button
        type="button"
        className="th-sort-btn"
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="th-sort-icons" aria-hidden="true">
          <span
            className={`caret ${active && currentDir === "asc" ? "caret--on" : ""}`}
          >
            ▲
          </span>
          <span
            className={`caret ${active && currentDir === "desc" ? "caret--on" : ""}`}
          >
            ▼
          </span>
        </span>
      </button>
    </th>
  );
}

/** Valor del option: prioridad en minúsculas; resto tal cual en el repo. */
function chartSelectOptionValue(name: string): string {
  if (allowedRecentChartName(name, [...RECENT_SIDEBAR_CHARTS])) {
    return name.trim().toLowerCase();
  }
  return name;
}

function chartSelectOptionLabel(name: string): string {
  return name.trim().toUpperCase();
}

/** Fechas en español: Hoy/Ayer, día cercano con hora, o fecha completa. */
function formatFriendlyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startThat = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diffDays = Math.round((startToday - startThat) / MS_PER_DAY);

  const hm = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  if (diffDays === 0) return `Hoy · ${hm}`;
  if (diffDays === 1) return `Ayer · ${hm}`;
  if (diffDays < 0) {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (diffDays < 7) {
    const weekday = new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
    }).format(d);
    const dayMonth = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    }).format(d);
    return `${weekday} ${dayMonth} · ${hm}`;
  }

  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat("es-ES", opts).format(d);
}

export default App;
