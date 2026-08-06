import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchMeasurements } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useThemeColors } from "../lib/useThemeColors";
import { formatDate, formatNumber } from "../lib/format";
import { Card } from "./Card";
import { ChartEmpty, ChartError, ChartLoading } from "./ChartStates";
import { ChartTooltip } from "./ChartTooltip";

const MIN_POINTS_TO_CHART = 3;

export function MeasurementsSection() {
  const { data, loading, error } = useAsync(() => fetchMeasurements(), []);
  const colors = useThemeColors();

  const weightCount = data?.filter((m) => m.weight_kg != null).length ?? 0;
  const leanMassCount = data?.filter((m) => m.lean_mass_kg != null).length ?? 0;
  const fatPercentCount = data?.filter((m) => m.fat_percent != null).length ?? 0;

  const showLeanMass = leanMassCount >= MIN_POINTS_TO_CHART;
  const showFatPercent = fatPercentCount >= MIN_POINTS_TO_CHART;

  return (
    <Card title="Body measurements" subtitle="All recorded history">
      {loading && !data && <ChartLoading label="Loading measurements…" />}
      {error && <ChartError message={error} />}
      {data && data.length === 0 && <ChartEmpty message="No body measurements recorded yet." />}

      {data && data.length > 0 && (
        <>
          {weightCount === 0 ? (
            <ChartEmpty message="No weight entries recorded yet." />
          ) : (
            <>
              <h3 className="section-label">
                Weight{showLeanMass ? " & lean mass" : ""} (kg)
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.gridline} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: colors.textMuted, fontSize: 12 }}
                    axisLine={{ stroke: colors.baseline }}
                    tickLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fill: colors.textMuted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatDate(v as string)}
                    content={(props) => (
                      <ChartTooltip {...props} valueFormatter={(v) => `${formatNumber(Number(v), 1)} kg`} />
                    )}
                  />
                  {showLeanMass && <Legend wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />}
                  <Line
                    type="monotone"
                    dataKey="weight_kg"
                    name="Weight"
                    stroke={colors.seriesBlue}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  {showLeanMass && (
                    <Line
                      type="monotone"
                      dataKey="lean_mass_kg"
                      name="Lean mass"
                      stroke={colors.seriesOrange}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {showFatPercent && (
            <>
              <h3 className="section-label">Body fat (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.gridline} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: colors.textMuted, fontSize: 12 }}
                    axisLine={{ stroke: colors.baseline }}
                    tickLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fill: colors.textMuted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatDate(v as string)}
                    content={(props) => (
                      <ChartTooltip {...props} valueFormatter={(v) => `${formatNumber(Number(v), 1)}%`} />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="fat_percent"
                    name="Body fat"
                    stroke={colors.seriesBlue}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {!showFatPercent && fatPercentCount > 0 && (
            <p className="chart-note">
              Body fat % has only {fatPercentCount} recorded point{fatPercentCount === 1 ? "" : "s"} —
              not enough yet to chart.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
