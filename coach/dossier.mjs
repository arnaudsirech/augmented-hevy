import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT, hevyGet, fetchPages } from "./hevy.mjs";

function epley1RM(weightKg, reps) {
  if (!weightKg || !reps) return null;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}

function summarizeExercise(ex) {
  const workingSets = (ex.sets ?? []).filter((s) => s.type !== "warmup");
  const volume_kg = Math.round(
    workingSets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0) * 100
  ) / 100;

  let top_set = null;
  for (const s of workingSets) {
    if (!top_set || (s.weight_kg ?? 0) > (top_set.weight_kg ?? 0)) {
      top_set = { weight_kg: s.weight_kg ?? null, reps: s.reps ?? null };
    }
  }

  return {
    index: ex.index,
    title: ex.title,
    exercise_template_id: ex.exercise_template_id,
    notes: ex.notes ?? "",
    sets: workingSets.map((s) => ({
      type: s.type,
      weight_kg: s.weight_kg ?? null,
      reps: s.reps ?? null,
      rpe: s.rpe ?? null,
    })),
    top_set,
    volume_kg,
    est_1rm: top_set ? epley1RM(top_set.weight_kg, top_set.reps) : null,
  };
}

function summarizeSession(workout) {
  const start = new Date(workout.start_time);
  const end = new Date(workout.end_time);
  const duration_min = Math.round((end - start) / 60000);

  return {
    id: workout.id,
    title: workout.title,
    date: workout.start_time.slice(0, 10),
    duration_min,
    exercises: (workout.exercises ?? []).map(summarizeExercise),
  };
}

function summarizeRoutine(routine) {
  return {
    id: routine.id,
    title: routine.title,
    exercises: (routine.exercises ?? []).map((ex) => {
      const sets = ex.sets ?? [];
      const topTarget = sets.reduce(
        (best, s) => ((s.weight_kg ?? 0) > (best?.weight_kg ?? -Infinity) ? s : best),
        null
      );
      return {
        exercise_template_id: ex.exercise_template_id,
        title: ex.title,
        notes: ex.notes ?? "",
        rest_seconds: ex.rest_seconds ?? null,
        target_sets: sets.length,
        target_weight_kg: topTarget?.weight_kg ?? null,
        target_reps: topTarget?.reps ?? null,
      };
    }),
  };
}

function trendFor(todayEst1rm, previousEst1rms) {
  if (!previousEst1rms.length) return "new";
  if (todayEst1rm == null) return "flat";
  const lastEst1rm = previousEst1rms[0];
  if (lastEst1rm == null) return "flat";
  const delta = (todayEst1rm - lastEst1rm) / lastEst1rm;
  if (delta > 0.02) return "up";
  if (delta < -0.02) return "down";
  return "flat";
}

function buildComparison(sessionSummary, historySummaries) {
  return sessionSummary.exercises.map((todayEx) => {
    const previous = [];
    for (const hist of historySummaries) {
      const match = hist.exercises.find(
        (e) => e.exercise_template_id === todayEx.exercise_template_id
      );
      if (match) {
        previous.push({
          date: hist.date,
          weight_kg: match.top_set?.weight_kg ?? null,
          reps: match.top_set?.reps ?? null,
          volume_kg: match.volume_kg,
          est_1rm: match.est_1rm,
        });
      }
    }

    return {
      exercise: todayEx.title,
      exercise_template_id: todayEx.exercise_template_id,
      today: {
        weight_kg: todayEx.top_set?.weight_kg ?? null,
        reps: todayEx.top_set?.reps ?? null,
        volume_kg: todayEx.volume_kg,
        est_1rm: todayEx.est_1rm,
      },
      previous,
      target_weight_kg: null, // rempli plus tard depuis routineSummary si dispo
      trend: trendFor(
        todayEx.est_1rm,
        previous.map((p) => p.est_1rm)
      ),
    };
  });
}

function journalTail(n = 3) {
  const journalPath = path.join(ROOT, "coach", "journal.md");
  if (!existsSync(journalPath)) return "";
  const raw = readFileSync(journalPath, "utf8");
  const entries = raw.split(/^## /m).filter((e) => e.trim());
  const tail = entries.slice(-n);
  return tail.map((e) => "## " + e.trim()).join("\n\n");
}

function contextMd() {
  const contextPath = path.join(ROOT, "coach", "context.md");
  if (!existsSync(contextPath)) return "";
  return readFileSync(contextPath, "utf8");
}

export async function buildDossier(workout) {
  const sessionSummary = summarizeSession(workout);

  let routineSummary = null;
  if (workout.routine_id) {
    const routineData = await hevyGet(`/routines/${workout.routine_id}`);
    routineSummary = summarizeRoutine(routineData.routine);
  }

  let historySummaries = [];
  if (workout.routine_id) {
    const startTime = workout.start_time;
    const sameRoutineWorkouts = await fetchPages("/workouts", "workouts", {
      pageSize: 10,
      maxPages: 6,
      stopWhen: (items) => {
        const matches = items.filter(
          (w) => w.routine_id === workout.routine_id && w.id !== workout.id && w.start_time < startTime
        );
        return matches.length >= 3;
      },
    });
    const matches = sameRoutineWorkouts
      .filter((w) => w.routine_id === workout.routine_id && w.id !== workout.id && w.start_time < startTime)
      .sort((a, b) => (a.start_time < b.start_time ? 1 : -1))
      .slice(0, 3);
    historySummaries = matches.map(summarizeSession);
  }

  const comparison = buildComparison(sessionSummary, historySummaries);
  if (routineSummary) {
    for (const row of comparison) {
      const target = routineSummary.exercises.find(
        (e) => e.exercise_template_id === row.exercise_template_id
      );
      if (target) row.target_weight_kg = target.target_weight_kg;
    }
  }

  const dossier = {
    generated_at: new Date().toISOString(),
    session: sessionSummary,
    routine: routineSummary,
    history: historySummaries,
    comparison,
    journal_tail: journalTail(3),
    context: contextMd(),
  };

  const outPath = path.join(ROOT, "coach", "state", `dossier-${workout.id}.json`);
  writeFileSync(outPath, JSON.stringify(dossier, null, 2));
  return { dossier, path: outPath };
}
