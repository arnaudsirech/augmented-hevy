const PRESETS = [28, 90, 180];

export function DayRangeSelector({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="range-selector" role="group" aria-label="Day range">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={preset === days ? "range-btn range-btn-active" : "range-btn"}
          onClick={() => onChange(preset)}
        >
          {preset}d
        </button>
      ))}
    </div>
  );
}
