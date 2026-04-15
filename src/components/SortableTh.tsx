import type { SortDir, SortKey } from "../charts/types";

type Props = {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
};

export function SortableTh({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: Props) {
  const active = sortKey === currentKey;
  const ariaSort = active
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const thClass = ["th-sort", className].filter(Boolean).join(" ");

  return (
    <th scope="col" aria-sort={ariaSort} className={thClass}>
      <button
        type="button"
        className="th-sort-btn"
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="th-sort-icons" aria-hidden="true">
          <span
            className={`caret ${active && currentDir === "asc" ? "caret--on" : ""}`}
          >
            ▲
          </span>
          <span
            className={`caret ${active && currentDir === "desc" ? "caret--on" : ""}`}
          >
            ▼
          </span>
        </span>
      </button>
    </th>
  );
}
