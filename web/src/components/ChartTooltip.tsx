import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: TooltipContentProps<ValueType, NameType> & {
  valueFormatter?: (value: ValueType, name: NameType) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      {label != null && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((entry, i) => (
        <div className="chart-tooltip-row" key={i}>
          <span className="chart-tooltip-swatch" style={{ background: entry.color }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">
            {valueFormatter && entry.value !== undefined
              ? valueFormatter(entry.value, entry.name as NameType)
              : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
