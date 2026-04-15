import { PAGE_SIZES, type PageSize } from "../charts/constants";

type Props = {
  totalFiltered: number;
  totalPages: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  loading: boolean;
  rowsLength: number;
};

export function PaginationBar({
  totalFiltered,
  totalPages,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  loading,
  rowsLength,
}: Props) {
  return (
    <div className="pagination-bottom-row">
      <nav
        className="pagination-nav pagination-nav--inline"
        aria-label="Paginación de resultados"
      >
        {totalFiltered > 0 && totalPages > 1 ? (
          <>
            <button
              type="button"
              className="btn secondary"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              Anterior
            </button>
            <span className="pagination-status">
              Página <strong>{page}</strong> de {totalPages}
            </span>
            <button
              type="button"
              className="btn secondary"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
              Siguiente
            </button>
          </>
        ) : null}
      </nav>
      <label className="field field-inline field-page-size field-page-size-bottom">
        <span className="field-label">Por página</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const n = Number(e.target.value) as PageSize;
            onPageSizeChange(n);
          }}
          disabled={loading && rowsLength === 0}
          aria-label="Número de filas por página"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
