type Props = {
  loading: boolean;
  onRefresh: () => void;
};

export function AppHeader({ loading, onRefresh }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        <img
          className="brand-logo"
          src="/cupcake-logo.svg"
          width={104}
          height={104}
          alt=""
          decoding="async"
        />
        <div className="brand-text">
          <h1>The Cupcake Store</h1>
        </div>
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={() => void onRefresh()}
        disabled={loading}
      >
        Actualizar
      </button>
    </header>
  );
}
