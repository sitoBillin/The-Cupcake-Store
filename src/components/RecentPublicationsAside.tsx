import type { ChartLatestSummary } from "../charts/types";
import { formatFriendlyDate } from "../utils/formatFriendlyDate";

type Props = {
  loadingInitial: boolean;
  summaries: ChartLatestSummary[];
};

export function RecentPublicationsAside({
  loadingInitial,
  summaries,
}: Props) {
  return (
    <aside className="app-sidebar" aria-label="Publicaciones recientes">
      <div className="recent-panel">
        <h2 className="recent-title">Últimas publicaciones</h2>
        {loadingInitial ? (
          <p className="recent-empty">Cargando…</p>
        ) : summaries.length === 0 ? (
          <p className="recent-empty">
            No hay datos con fecha de creación (
            <code className="inline-code">created</code>) para agrupar por
            chart. Cuando ChartMuseum lo envíe, aquí verás la última versión
            publicada y la anterior por fecha.
          </p>
        ) : (
          <ol className="recent-list">
            {summaries.map((pair) => {
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
  );
}
