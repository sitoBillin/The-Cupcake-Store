import { RECENT_SIDEBAR_CHARTS } from "./constants";
import { allowedRecentChartName } from "./recentSummaries";

export function buildChartSelectOrdered(chartOptions: string[]): string[] {
  const tail = chartOptions
    .filter((n) => !allowedRecentChartName(n, [...RECENT_SIDEBAR_CHARTS]))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...RECENT_SIDEBAR_CHARTS, ...tail];
}

/** Valor del option: prioridad en minúsculas; resto tal cual en el repo. */
export function chartSelectOptionValue(name: string): string {
  if (allowedRecentChartName(name, [...RECENT_SIDEBAR_CHARTS])) {
    return name.trim().toLowerCase();
  }
  return name;
}

export function chartSelectOptionLabel(name: string): string {
  return name.trim().toUpperCase();
}
