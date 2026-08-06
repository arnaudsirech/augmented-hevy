export function ChartLoading({ label = "Loading…" }: { label?: string }) {
  return <div className="chart-state chart-state-muted">{label}</div>;
}

export function ChartError({ message }: { message: string }) {
  return <div className="chart-state chart-state-error">Couldn't load this: {message}</div>;
}

export function ChartEmpty({ message = "No data for this range yet." }: { message?: string }) {
  return <div className="chart-state chart-state-muted">{message}</div>;
}
