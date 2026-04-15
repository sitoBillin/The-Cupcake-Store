import type { ChartRow } from "../api/chartmuseum";
import { formatFriendlyDate } from "../utils/formatFriendlyDate";

type Props = {
  row: ChartRow;
  panelId: string;
  deleteDisabled: boolean;
  onRequestDelete: () => void;
};

export function ChartDetailPanel({
  row,
  panelId,
  deleteDisabled,
  onRequestDelete,
}: Props) {
  return (
    <div className="chart-detail-panel" id={panelId}>
      <div className="chart-detail-layout">
        <section className="chart-detail-section chart-detail-section--wide">
          <h3 className="chart-detail-heading">Descripción</h3>
          <p className="chart-detail-body">
            {row.description?.trim()
              ? row.description
              : "Sin descripción en el índice."}
          </p>
        </section>

        <div className="chart-detail-tiles">
          {row.created ? (
            <section className="chart-detail-section chart-detail-tile">
              <h3 className="chart-detail-heading">Publicado</h3>
              <p className="chart-detail-body chart-detail-body--emph">
                {formatFriendlyDate(row.created)}
              </p>
              <p className="chart-detail-meta mono">{row.created}</p>
            </section>
          ) : null}
          {row.home ? (
            <section className="chart-detail-section chart-detail-tile">
              <h3 className="chart-detail-heading">Home</h3>
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
              <h3 className="chart-detail-heading">Digest</h3>
              <p className="chart-detail-body mono chart-detail-digest">
                {row.digest}
              </p>
            </section>
          ) : null}
        </div>

        {row.urls && row.urls.length > 0 ? (
          <section className="chart-detail-section chart-detail-section--wide">
            <h3 className="chart-detail-heading">URLs del paquete</h3>
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
          disabled={deleteDisabled}
          onClick={onRequestDelete}
        >
          Eliminar esta versión…
        </button>
      </div>
    </div>
  );
}
