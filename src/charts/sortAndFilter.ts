import type { ChartRow } from "../api/chartmuseum";
import type { SortDir, SortKey } from "./types";

export function uniqueChartNames(rows: ChartRow[]): string[] {
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
  dir: SortDir,
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
export function compareSemverDesc(va: string, vb: string): number {
  return vb.localeCompare(va, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRows(
  rows: ChartRow[],
  key: SortKey,
  dir: SortDir,
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

export function filterCharts(
  rows: ChartRow[],
  chartNameFilter: string,
  textFilter: string,
): ChartRow[] {
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

  return list;
}
