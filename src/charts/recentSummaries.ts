import type { ChartRow } from "../api/chartmuseum";
import { RECENT_SIDEBAR_CHARTS } from "./constants";
import { compareSemverDesc } from "./sortAndFilter";
import type { ChartLatestSummary } from "./types";

export function allowedRecentChartName(
  chartName: string,
  allowed: readonly string[],
): boolean {
  const n = chartName.trim().toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase() === n);
}

export function buildLatestPerChartByDate(
  rows: ChartRow[],
): ChartLatestSummary[] {
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
        !allowedRecentChartName(s.latest.chartName, [
          ...RECENT_SIDEBAR_CHARTS,
        ]),
    )
    .sort(
      (a, b) => Date.parse(b.latest.created!) - Date.parse(a.latest.created!),
    );
  ordered.push(...rest);
  return ordered;
}
