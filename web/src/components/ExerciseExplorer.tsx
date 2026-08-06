import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchExerciseStats, fetchExerciseTemplates, type ExerciseTemplate } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useThemeColors } from "../lib/useThemeColors";
import { formatDate, formatNumber } from "../lib/format";
import { Card } from "./Card";
import { StatTile } from "./StatTile";
import { ChartEmpty, ChartError, ChartLoading } from "./ChartStates";
import { ChartTooltip } from "./ChartTooltip";
import { ExercisePicker } from "./ExercisePicker";

export function ExerciseExplorer() {
  const templatesState = useAsync(() => fetchExerciseTemplates(), []);
  const [selected, setSelected] = useState<ExerciseTemplate | null>(null);
  const colors = useThemeColors();

  // Default to the first template once templates load, so the section isn't empty.
  useEffect(() => {
    if (!selected && templatesState.data && templatesState.data.length > 0) {
      setSelected(templatesState.data[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesState.data]);

  const statsState = useAsync(
    () => (selected ? fetchExerciseStats(selected.id) : Promise.resolve(null)),
    [selected?.id],
  );

  const stats = statsState.data;
  const progression = stats?.history.filter((h) => h.bestSet != null) ?? [];

  return (
    <Card title="Exercise explorer" subtitle="Progression & personal records">
      {templatesState.loading && !templatesState.data && <ChartLoading label="Loading exercises…" />}
      {templatesState.error && <ChartError message={templatesState.error} />}

      {templatesState.data && (
        <>
          <ExercisePicker
            templates={templatesState.data}
            selected={selected}
            onSelect={setSelected}
          />

          {statsState.loading && <ChartLoading label="Loading exercise history…" />}
          {statsState.error && <ChartError message={statsState.error} />}

          {stats && (
            <>
              <div className="stat-grid stat-grid-compact">
                <StatTile
                  label="Best weight"
                  value={
                    stats.personalRecords.maxWeightKg
                      ? `${formatNumber(stats.personalRecords.maxWeightKg.value, 1)} kg`
                      : "—"
                  }
                  hint={stats.personalRecords.maxWeightKg ? formatDate(stats.personalRecords.maxWeightKg.date) : undefined}
                />
                <StatTile
                  label="Best est. 1RM"
                  value={
                    stats.personalRecords.maxEstimated1Rm
                      ? `${formatNumber(stats.personalRecords.maxEstimated1Rm.value, 1)} kg`
                      : "—"
                  }
                  hint={
                    stats.personalRecords.maxEstimated1Rm
                      ? formatDate(stats.personalRecords.maxEstimated1Rm.date)
                      : undefined
                  }
                />
                <StatTile
                  label="Best reps"
                  value={
                    stats.personalRecords.maxReps ? formatNumber(stats.personalRecords.maxReps.value) : "—"
                  }
                  hint={stats.personalRecords.maxReps ? formatDate(stats.personalRecords.maxReps.date) : undefined}
                />
              </div>

              <h3 className="section-label">Estimated 1RM progression</h3>
              {progression.length === 0 ? (
                <ChartEmpty message="No completed working sets recorded for this exercise yet." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={progression.map((p) => ({ date: p.date, estimated1Rm: p.bestSet?.estimated1Rm ?? null }))}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
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
                    <Line
                      type="monotone"
                      dataKey="estimated1Rm"
                      name="Est. 1RM"
                      stroke={colors.seriesBlue}
                      strokeWidth={2}
                      dot={{ r: 4, fill: colors.seriesBlue, strokeWidth: 2, stroke: colors.surface }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
