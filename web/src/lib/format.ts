export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatWeek(weekKey: string): string {
  // week key is an ISO date (Monday of that week) per server's isoWeekKey()
  const d = new Date(weekKey);
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatNumber(n: number | null | undefined, fractionDigits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatKg(n: number | null | undefined, fractionDigits = 0): string {
  if (n == null) return "—";
  return `${formatNumber(n, fractionDigits)} kg`;
}

export function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
