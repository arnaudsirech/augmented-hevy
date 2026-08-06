import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchVolumeByMuscle } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useThemeColors } from "../lib/useThemeColors";
import { formatNumber, titleCase } from "../lib/format";
import { Card } from "./Card";
import { ChartEmpty, ChartError, ChartLoading } from "./ChartStates";
import { ChartTooltip } from "./ChartTooltip";

export function VolumeByMuscleChart({ days }: { days: number }) {
  const { data, loading, error } = useAsync(() => fetchVolumeByMuscle(days), [days]);
  const colors = useThemeColors();

  const height = data ? Math.max(220, data.length * 32 + 40) : 220;

  return (
    <Card title="Volume by muscle group" subtitle={`Last ${days} days`}>
      {loading && !data && <ChartLoading label="Loading volume by muscle…" />}
      {error && <ChartError message={error} />}
      {data && data.length === 0 && <ChartEmpty />}
      {data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid stroke={colors.gridline} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: colors.textMuted, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="muscleGroup"
              tickFormatter={(v: string) => titleCase(v)}
              tick={{ fill: colors.textSecondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={110}
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
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
