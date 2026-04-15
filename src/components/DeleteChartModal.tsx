import type { ChartRow } from "../api/chartmuseum";

type Props = {
  row: ChartRow;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteChartModal({ row, deleting, onCancel, onConfirm }: Props) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!deleting) onCancel();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-modal-title" className="modal-title">
          Confirmar eliminación
        </h2>
        <p className="modal-body">
          Se eliminará del ChartMuseum la versión{" "}
          <strong className="mono">{row.version}</strong> del chart{" "}
          <strong>{row.chartName}</strong>. Esta acción no se puede deshacer.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={deleting}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={deleting}
            aria-busy={deleting}
            onClick={() => void onConfirm()}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
