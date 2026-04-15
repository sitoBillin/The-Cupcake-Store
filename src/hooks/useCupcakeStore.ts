import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteChartVersion,
  fetchCharts,
  type ChartRow,
} from "../api/chartmuseum";
import {
  DEFAULT_CHART_FILTER,
  RECENT_SIDEBAR_CHARTS,
  type PageSize,
} from "../charts/constants";
import { buildLatestPerChartByDate } from "../charts/recentSummaries";
import {
  filterCharts,
  sortRows,
  uniqueChartNames,
} from "../charts/sortAndFilter";
import type { SortKey } from "../charts/types";

export function useCupcakeStore() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [chartNameFilter, setChartNameFilter] = useState(DEFAULT_CHART_FILTER);
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

  useEffect(() => {
    if (chartOptions.length === 0 || !chartNameFilter) return;
    const lower = chartNameFilter.trim().toLowerCase();
    const inApi = chartOptions.some((n) => n.trim().toLowerCase() === lower);
    const isPriority = [...RECENT_SIDEBAR_CHARTS].some((p) => p === lower);
    if (!inApi && !isPriority) {
      setChartNameFilter(DEFAULT_CHART_FILTER);
    }
  }, [chartOptions, chartNameFilter]);

  const filteredSorted = useMemo(() => {
    const list = filterCharts(rows, chartNameFilter, textFilter);
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

  const onSortClick = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (key === prevKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir(key === "created" ? "desc" : "asc");
      return key;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setChartNameFilter(DEFAULT_CHART_FILTER);
    setTextFilter("");
  }, []);

  const hasActiveFilters = Boolean(
    textFilter.trim() ||
      chartNameFilter.trim().toLowerCase() !== DEFAULT_CHART_FILTER,
  );

  const openDeleteModal = useCallback((row: ChartRow) => {
    setPendingDelete(row);
  }, []);

  const cancelDeleteModal = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const confirmDeleteFromModal = useCallback(async () => {
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
  }, [pendingDelete, load]);

  const toggleRowExpanded = useCallback((key: string) => {
    setExpandedRowKey((k) => (k === key ? null : key));
  }, []);

  const onPageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return {
    rows,
    loading,
    error,
    load,
    chartNameFilter,
    setChartNameFilter,
    textFilter,
    setTextFilter,
    sortKey,
    sortDir,
    onSortClick,
    clearFilters,
    hasActiveFilters,
    deletingKey,
    expandedRowKey,
    pendingDelete,
    cancelDeleteModal,
    confirmDeleteFromModal,
    openDeleteModal,
    toggleRowExpanded,
    page,
    setPage,
    pageSize,
    onPageSizeChange,
    totalFiltered,
    totalPages,
    pageRows,
    rangeFrom,
    rangeTo,
    recentChartSummaries,
  };
}
