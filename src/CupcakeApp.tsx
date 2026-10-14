import { CHARTMUSEUM_DOTENV_KEYS } from "./env/chartmuseumEnvNames";
import { AppHeader } from "./components/AppHeader";
import { ChartTable } from "./components/ChartTable";
import { DeleteChartModal } from "./components/DeleteChartModal";
import { FiltersBar } from "./components/FiltersBar";
import { PaginationBar } from "./components/PaginationBar";
import { RecentPublicationsAside } from "./components/RecentPublicationsAside";
import { useCupcakeStore } from "./hooks/useCupcakeStore";

export function CupcakeApp() {
  const s = useCupcakeStore();

  return (
    <main className="app">
      <AppHeader loading={s.loading} onRefresh={s.load} />

      <div className="app-layout">
        <div className="app-main">
          <FiltersBar
            rows={s.rows}
            loading={s.loading}
            chartNameFilter={s.chartNameFilter}
            onChartNameFilterChange={s.setChartNameFilter}
            textFilter={s.textFilter}
            onTextFilterChange={s.setTextFilter}
            onClearFilters={s.clearFilters}
            clearFiltersDisabled={!s.hasActiveFilters}
            totalFiltered={s.totalFiltered}
            rangeFrom={s.rangeFrom}
            rangeTo={s.rangeTo}
          />

          {s.error ? (
            <div className="alert error" role="alert">
              {s.error}
              <p className="hint">
                Comprueba{" "}
                <code className="inline-code">{CHARTMUSEUM_DOTENV_KEYS.baseUrl}</code>{" "}
                (sin <code className="inline-code">/api</code> al final),{" "}
                <code className="inline-code">{CHARTMUSEUM_DOTENV_KEYS.user}</code> y{" "}
                <code className="inline-code">{CHARTMUSEUM_DOTENV_KEYS.password}</code>{" "}
                en <code className="inline-code">.env</code>; las peticiones van por el
                proxy <code className="inline-code">/chartmuseum</code>. Reinicia{" "}
                <code className="inline-code">npm run dev</code> o{" "}
                <code className="inline-code">npm run preview</code> tras cambiar el
                entorno.
              </p>
            </div>
          ) : null}

          <ChartTable
            loading={s.loading}
            rowsCount={s.rows.length}
            filteredCount={s.totalFiltered}
            pageRows={s.pageRows}
            sortKey={s.sortKey}
            sortDir={s.sortDir}
            onSortClick={s.onSortClick}
            expandedRowKey={s.expandedRowKey}
            onToggleRow={s.toggleRowExpanded}
            deletingKey={s.deletingKey}
            onRequestDelete={s.openDeleteModal}
          />

          <PaginationBar
            totalFiltered={s.totalFiltered}
            totalPages={s.totalPages}
            page={s.page}
            onPageChange={s.setPage}
            pageSize={s.pageSize}
            onPageSizeChange={s.onPageSizeChange}
            loading={s.loading}
            rowsLength={s.rows.length}
          />
        </div>

        <RecentPublicationsAside
          loadingInitial={s.loading && s.rows.length === 0}
          summaries={s.recentChartSummaries}
        />
      </div>

      {s.pendingDelete ? (
        <DeleteChartModal
          row={s.pendingDelete}
          deleting={s.deletingKey !== null}
          onCancel={s.cancelDeleteModal}
          onConfirm={s.confirmDeleteFromModal}
        />
      ) : null}
    </main>
  );
}
