/** Ruta relativa: el servidor Vite hace de proxy y añade Basic Auth (ver vite.config.ts). */
const PROXY_PREFIX = '/chartmuseum'

export type ChartRow = {
  chartName: string
  version: string
  description: string
  created?: string
  home?: string
  digest?: string
  urls?: string[]
}

function normalizeChartResponse(data: unknown): ChartRow[] {
  if (!data || typeof data !== 'object') {
    return []
  }

  const rows: ChartRow[] = []

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (typeof o.name !== 'string' || typeof o.version !== 'string') continue
      rows.push({
        chartName: o.name,
        version: o.version,
        description: typeof o.description === 'string' ? o.description : '',
        created: typeof o.created === 'string' ? o.created : undefined,
        home: typeof o.home === 'string' ? o.home : undefined,
        digest: typeof o.digest === 'string' ? o.digest : undefined,
        urls: Array.isArray(o.urls)
          ? (o.urls as unknown[]).filter((u): u is string => typeof u === 'string')
          : undefined,
      })
    }
  } else {
    for (const [key, versions] of Object.entries(data as Record<string, unknown>)) {
      if (!Array.isArray(versions)) continue
      for (const item of versions) {
        if (!item || typeof item !== 'object') continue
        const o = item as Record<string, unknown>
        if (typeof o.version !== 'string') continue
        const name = typeof o.name === 'string' ? o.name : key
        rows.push({
          chartName: name,
          version: o.version,
          description: typeof o.description === 'string' ? o.description : '',
          created: typeof o.created === 'string' ? o.created : undefined,
          home: typeof o.home === 'string' ? o.home : undefined,
          digest: typeof o.digest === 'string' ? o.digest : undefined,
          urls: Array.isArray(o.urls)
            ? (o.urls as unknown[]).filter((u): u is string => typeof u === 'string')
            : undefined,
        })
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.chartName.localeCompare(b.chartName) ||
      b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

export async function fetchCharts(): Promise<ChartRow[]> {
  const res = await fetch(`${PROXY_PREFIX}/api/charts`)
  if (!res.ok) {
    throw new Error(`ChartMuseum respondió ${res.status} (${res.statusText})`)
  }
  const data: unknown = await res.json()
  return normalizeChartResponse(data)
}

export async function deleteChartVersion(chartName: string, version: string): Promise<void> {
  const path = `${PROXY_PREFIX}/api/charts/${encodeURIComponent(chartName)}/${encodeURIComponent(version)}`
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(detail.trim() || `No se pudo eliminar (${res.status})`)
  }
}
