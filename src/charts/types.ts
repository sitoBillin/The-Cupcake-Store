import type { ChartRow } from "../api/chartmuseum";

export type SortKey = "chartName" | "version" | "created";

export type SortDir = "asc" | "desc";

/** Por chart: versión más reciente por `created` y la inmediatamente anterior por fecha. */
export type ChartLatestSummary = {
  displayName: string;
  latest: ChartRow;
  previous?: ChartRow;
};
