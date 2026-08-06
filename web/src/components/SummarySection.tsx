import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchSummary } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useThemeColors } from "../lib/useThemeColors";
import { formatDate, formatNumber, formatWeek } from "../lib/format";
import { Card } from "./Card";
import { StatTile } from "./StatTile";
import { ChartEmpty, ChartError, ChartLoading } from "./ChartStates";
import { ChartTooltip } from "./ChartTooltip";

export function SummarySection({ days }: { days: number }) {
  const { data, loading, error } = useAsync(() => fetchSummary(days), [days]);
  const colors = useThemeColors();

  return (
    <Card title="Overview" subtitle={`Last ${days} days`}>
      {loading && !data && <ChartLoading label="Loading summary…" />}
      {error && <ChartError message={error} />}
      {data && (
        <>
          <div className="stat-grid">
            <StatTile label="Workouts" value={formatNumber(data.workoutCount)} />
            <StatTile label="Total volume" value={`${formatNumber(data.totalVolumeKg)} kg`} />
            <StatTile label="Total sets" value={formatNumber(data.totalSets)} />
            <StatTile label="Avg workouts / week" value={data.avgWorkoutsPerWeek.toFixed(1)} />
            <StatTile
              label="Current streak"
              value={`${data.currentStreakWeeks} wk${data.currentStreakWeeks === 1 ? "" : "s"}`}
            />
            <StatTile label="Last workout" value={formatDate(data.lastWorkoutAt)} />
          </div>

          <h3 className="section-label">Weekly volume</h3>
          {data.weeklyVolume.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.weeklyVolume} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={colors.gridline} vertical={false} />
                <XAxis
                  dataKey="week"
                  tickFormatter={formatWeek}
                  tick={{ fill: colors.textMuted, fontSize: 12 }}
                  axisLine={{ stroke: colors.baseline }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: colors.textMuted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <Tooltip
                  cursor={{ fill: colors.gridline, opacity: 0.5 }}
                  content={(props) => (
                    <ChartTooltip {...props} valueFormatter={(v) => `${formatNumber(Number(v))} kg`} />
                  )}
                />
                <Bar
                  dataKey="volumeKg"
                  name="Volume"
                  fill={colors.seriesBlue}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </Card>
  );
}
