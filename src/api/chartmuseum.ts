import { CHARTMUSEUM_DOTENV_KEYS } from "../env/chartmuseumEnvNames";

/** Ruta relativa: en local hace de proxy Vite (vite.config.ts); desplegado, server/server.mjs. */
const PROXY_PREFIX = "/chartmuseum";

export type ChartRow = {
  chartName: string;
  version: string;
  description: string;
  created?: string;
  home?: string;
  digest?: string;
  urls?: string[];
};

function normalizeChartResponse(data: unknown): ChartRow[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const rows: ChartRow[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.name !== "string" || typeof o.version !== "string") continue;
      rows.push({
        chartName: o.name,
        version: o.version,
        description: typeof o.description === "string" ? o.description : "",
        created: typeof o.created === "string" ? o.created : undefined,
        home: typeof o.home === "string" ? o.home : undefined,
        digest: typeof o.digest === "string" ? o.digest : undefined,
        urls: Array.isArray(o.urls)
          ? (o.urls as unknown[]).filter((u): u is string => typeof u === "string")
          : undefined,
      });
    }
  } else {
    for (const [key, versions] of Object.entries(data as Record<string, unknown>)) {
      if (!Array.isArray(versions)) continue;
      for (const item of versions) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (typeof o.version !== "string") continue;
        const name = typeof o.name === "string" ? o.name : key;
        rows.push({
          chartName: name,
          version: o.version,
          description: typeof o.description === "string" ? o.description : "",
          created: typeof o.created === "string" ? o.created : undefined,
          home: typeof o.home === "string" ? o.home : undefined,
          digest: typeof o.digest === "string" ? o.digest : undefined,
          urls: Array.isArray(o.urls)
            ? (o.urls as unknown[]).filter((u): u is string => typeof u === "string")
            : undefined,
        });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.chartName.localeCompare(b.chartName) ||
      b.version.localeCompare(a.version, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );
}

function bodyLooksLikeHtml(text: string): boolean {
  const s = text.trimStart().toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html");
}

/** El servidor de producción (server/server.mjs) responde así cuando no hay sesión de Google. */
function redirectToLoginIfUnauthenticated(res: Response, text: string): void {
  if (res.status !== 401) return;
  try {
    if ((JSON.parse(text) as { error?: unknown }).error === "unauthenticated") {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  } catch {
    // 401 de ChartMuseum (basic auth), no del servidor de Cupcake.
  }
}

async function parseChartmuseumChartsJson(res: Response): Promise<unknown> {
  const text = await res.text();
  redirectToLoginIfUnauthenticated(res, text);
  if (bodyLooksLikeHtml(text)) {
    throw new Error(
      `El servidor devolvió HTML en lugar del JSON del índice (/api/charts). Comprueba ${CHARTMUSEUM_DOTENV_KEYS.baseUrl}, ${CHARTMUSEUM_DOTENV_KEYS.user} y ${CHARTMUSEUM_DOTENV_KEYS.password} en .env (sin /api al final en la URL base).`,
    );
  }
  if (!res.ok) {
    throw new Error(
      text.trim().slice(0, 400) ||
        `ChartMuseum respondió ${res.status} (${res.statusText})`,
    );
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("ChartMuseum respondió 200 con cuerpo vacío (¿URL o proxy mal configurado?).");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const preview = trimmed.slice(0, 120);
    throw new Error(
      `La respuesta no es JSON válido (empieza por: ${preview}${trimmed.length > 120 ? "…" : ""}).`,
    );
  }
}

export async function fetchCharts(): Promise<ChartRow[]> {
  const res = await fetch(`${PROXY_PREFIX}/api/charts`);
  const data = await parseChartmuseumChartsJson(res);
  return normalizeChartResponse(data);
}

export async function deleteChartVersion(
  chartName: string,
  version: string,
): Promise<void> {
  const path = `${PROXY_PREFIX}/api/charts/${encodeURIComponent(chartName)}/${encodeURIComponent(version)}`;
  const res = await fetch(path, { method: "DELETE" });
  const text = await res.text();
  redirectToLoginIfUnauthenticated(res, text);
  if (!res.ok) {
    if (bodyLooksLikeHtml(text)) {
      throw new Error(
        `El servidor respondió con HTML en lugar de un error JSON (revisa ${CHARTMUSEUM_DOTENV_KEYS.baseUrl} y auth en .env).`,
      );
    }
    throw new Error(text.trim() || `No se pudo eliminar (${res.status})`);
  }
}
