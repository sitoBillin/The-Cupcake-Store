const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fechas en español: Hoy/Ayer, día cercano con hora, o fecha completa. */
export function formatFriendlyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startThat = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diffDays = Math.round((startToday - startThat) / MS_PER_DAY);

  const hm = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  if (diffDays === 0) return `Hoy · ${hm}`;
  if (diffDays === 1) return `Ayer · ${hm}`;
  if (diffDays < 0) {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (diffDays < 7) {
    const weekday = new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
    }).format(d);
    const dayMonth = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    }).format(d);
    return `${weekday} ${dayMonth} · ${hm}`;
  }

  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat("es-ES", opts).format(d);
}
