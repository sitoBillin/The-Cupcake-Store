export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

/** Charts que aparecen primero en el selector y al inicio del panel lateral. */
export const RECENT_SIDEBAR_CHARTS = ["tortilla", "gofre", "gofrera"] as const;

export const DEFAULT_CHART_FILTER = "tortilla";
