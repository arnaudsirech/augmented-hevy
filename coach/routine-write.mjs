import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, hevyGet, hevyPut, fetchPages } from "./hevy.mjs";

const NOTE_FIRST_LINE_RE = /^\d+x\d+(-\d+)? @ [\d.]+ ?kg/i;
const MAX_NOTE_CHARS = 160;
// Plafonds de variation de charge par exercice et par séance.
// Un cran de poulie légère fait un gros % pour peu de kilos (5,7 -> 6,8 = +19 %), donc le
// plafond en % ne s'applique qu'au-delà d'un écart absolu réel : sinon on refuserait les
// progressions normales sur les accessoires légers.
const MAX_DELTA_KG = 5; // jamais plus de 5 kg d'écart, quel que soit le %
const MAX_DELTA_PCT = 0.10; // au-delà de 10 %...
const PCT_FLOOR_KG = 2.5; // ...uniquement si l'écart dépasse aussi 2,5 kg
const CAPS = { maxKg: MAX_DELTA_KG, maxPct: MAX_DELTA_PCT, pctFloorKg: PCT_FLOOR_KG };

// Plafonds élargis pour la propagation. La charge a déjà passé les plafonds
// stricts contre la routine du jour : ici on ne juge plus une progression, on
// rattrape une dérive entre routines (Straight Arm à 29 d'un côté, 30,5 de
// l'autre) — et refuser à 10 % gèlerait précisément l'écart qu'on veut fermer.
// Le garde-fou reste : un nombre aberrant ne se répand pas dans tout le programme.
const PROPAGATION_CAPS = { maxKg: 10, maxPct: 0.25, pctFloorKg: 2.5 };

// Les routines de décharge portent leurs propres charges réduites : y recopier
// la charge d'une séance normale annulerait la décharge.
const DELOAD_RE = /deload/i;

/**
 * Un exercice vit dans plusieurs routines (Face Pull en Upper Body 2, Straight Arm
 * en Width Day ET Upper Body 2...). N'écrire que la routine de la séance du jour
 * laisse les autres sur l'ancienne charge : au 29 août, Straight Arm valait 29 kg
 * d'un côté et 30,5 kg de l'autre, Squat 60 et 62,5. La cible appartient à
 * l'exercice, pas à la séance — donc on la recopie partout.
 */
function workingSetCount(ex) {
  return (ex.sets ?? []).filter((s) => s.type !== "warmup").length;
}

/**
 * La ligne 1 d'une note annonce le nombre de séries ("3x8-12 @ 29kg"). Si la
 * routine cible en a un autre nombre, on réécrit ce chiffre plutôt que de
 * propager une note qui ment.
 */
function retargetNote(notes, setCount) {
  if (!notes || setCount < 1) return notes;
  const lines = notes.split("\n");
  lines[0] = lines[0].replace(/^\s*\d+(?=\s*[x×])/, String(setCount));
  return lines.join("\n");
}

function backupPath(routineId) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(ROOT, "coach", "state", "routine-backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, `${routineId}-${ts}.json`);
}

function validateChange(change, liveExercise, caps = CAPS) {
  const errors = [];
  const allowedKeys = new Set(["exercise_template_id", "target_weight_kg", "notes"]);
  for (const key of Object.keys(change)) {
    if (!allowedKeys.has(key)) errors.push(`clé non autorisée: ${key}`);
  }

  if (change.target_weight_kg !== undefined) {
    const w = change.target_weight_kg;
    if (!Number.isFinite(w) || w <= 0) {
      errors.push(`target_weight_kg invalide: ${w}`);
    } else if (Math.round(w * 10) !== w * 10) {
      errors.push(`target_weight_kg doit être un multiple de 0.1: ${w}`);
    } else {
      const currentTop = liveExercise.sets.reduce(
        (best, s) => ((s.weight_kg ?? 0) > (best ?? -Infinity) ? s.weight_kg : best),
        null
      );
      if (currentTop != null) {
        const delta = Math.abs(w - currentTop);
        const pct = currentTop > 0 ? delta / currentTop : 1;
        if (delta > caps.maxKg || (pct > caps.maxPct && delta > caps.pctFloorKg)) {
          errors.push(
            `variation trop grande pour ${liveExercise.title}: ${currentTop}kg -> ${w}kg (${(pct * 100).toFixed(1)}%, ${delta}kg)`
          );
        }
      }
    }
  }

  if (change.notes !== undefined) {
    const notes = change.notes;
    const lines = notes.split("\n");
    if (lines.length > 2) errors.push(`notes: plus de 2 lignes pour ${liveExercise.title}`);
    if (notes.length > MAX_NOTE_CHARS) errors.push(`notes: trop longues pour ${liveExercise.title} (${notes.length} car.)`);
    if (!NOTE_FIRST_LINE_RE.test(lines[0] ?? "")) {
      errors.push(`notes: première ligne ne matche pas le format attendu pour ${liveExercise.title}: "${lines[0]}"`);
    }
  }

  return errors;
}

function mapExerciseForPut(liveEx, change) {
  const sets = liveEx.sets.map((s) => {
    const out = {
      type: s.type,
      weight_kg: s.weight_kg,
      reps: s.reps,
      distance_meters: s.distance_meters,
      duration_seconds: s.duration_seconds,
      custom_metric: s.custom_metric,
    };
    if (change?.target_weight_kg !== undefined && s.type !== "warmup") {
      out.weight_kg = change.target_weight_kg;
    }
    return out;
  });

  return {
    exercise_template_id: liveEx.exercise_template_id,
    superset_id: liveEx.superset_id ?? liveEx.supersets_id ?? null,
    rest_seconds: liveEx.rest_seconds,
    notes: change?.notes !== undefined ? change.notes : liveEx.notes,
    sets,
  };
}

function diffApplied(before, after, changes) {
  const applied = [];
  const mismatches = [];

  for (const change of changes) {
    const beforeEx = before.exercises.find((e) => e.exercise_template_id === change.exercise_template_id);
    const afterEx = after.exercises.find((e) => e.exercise_template_id === change.exercise_template_id);
    if (!afterEx) {
      mismatches.push(`exercice absent après écriture: ${change.exercise_template_id}`);
      continue;
    }

    const entry = { exercise: afterEx.title, exercise_template_id: change.exercise_template_id };

    if (change.target_weight_kg !== undefined) {
      const beforeTop = beforeEx?.sets?.reduce((b, s) => Math.max(b, s.weight_kg ?? 0), 0) ?? null;
      const afterTop = afterEx.sets?.reduce((b, s) => Math.max(b, s.weight_kg ?? 0), 0) ?? null;
      entry.from = beforeTop;
      entry.to = afterTop;
      if (Math.abs(afterTop - change.target_weight_kg) > 0.01) {
        mismatches.push(
          `charge non appliquée sur ${afterEx.title}: attendu ${change.target_weight_kg}, obtenu ${afterTop}`
        );
      }
    }

    if (change.notes !== undefined) {
      entry.notes_changed = afterEx.notes === change.notes;
      if (!entry.notes_changed) {
        mismatches.push(`notes non appliquées sur ${afterEx.title}`);
      }
    }

    applied.push(entry);
  }

  return { applied, mismatches };
}

/**
 * Recopie les charges/notes qui viennent d'être écrites dans toutes les autres
 * routines qui contiennent le même exercice.
 *
 * Best-effort et jamais bloquant : la routine du jour est déjà écrite et
 * vérifiée quand on arrive ici. Une routine secondaire dont l'écart dépasse les
 * plafonds est sautée avec sa raison, pas propagée de force — c'est exactement
 * le garde-fou qui empêcherait une erreur de se répandre dans tout le programme.
 */
async function propagate(primaryRoutine, changes, { dryRun }) {
  const propagated = [];
  const skipped = [];

  if (DELOAD_RE.test(primaryRoutine.title ?? "")) {
    skipped.push({ reason: "séance de décharge: charges non propagées" });
    return { propagated, skipped };
  }

  const all = await fetchPages("/routines", "routines", { pageSize: 10, maxPages: 6 });

  for (const summary of all) {
    if (summary.id === primaryRoutine.id) continue;
    if (DELOAD_RE.test(summary.title ?? "")) continue;
    if (!(summary.exercises ?? []).some((e) => changes.some((c) => c.exercise_template_id === e.exercise_template_id))) {
      continue;
    }

    const targetData = await hevyGet(`/routines/${summary.id}`);
    const target = targetData.routine;

    const localChanges = [];
    for (const change of changes) {
      const ex = target.exercises.find((e) => e.exercise_template_id === change.exercise_template_id);
      if (!ex) continue;

      const local = { exercise_template_id: change.exercise_template_id };
      if (change.target_weight_kg !== undefined) local.target_weight_kg = change.target_weight_kg;
      if (change.notes !== undefined) local.notes = retargetNote(change.notes, workingSetCount(ex));

      const errs = validateChange(local, ex, PROPAGATION_CAPS);
      if (errs.length > 0) {
        skipped.push({ routine: target.title, exercise: ex.title, errors: errs });
        continue;
      }
      localChanges.push(local);
    }

    if (localChanges.length === 0) continue;

    if (dryRun) {
      for (const c of localChanges) {
        const ex = target.exercises.find((e) => e.exercise_template_id === c.exercise_template_id);
        propagated.push({
          routine: target.title,
          exercise: ex.title,
          from: ex.sets.reduce((b, s) => Math.max(b, s.weight_kg ?? 0), 0),
          to: c.target_weight_kg ?? null,
          dry_run: true,
        });
      }
      continue;
    }

    writeFileSync(backupPath(target.id), JSON.stringify(targetData, null, 2));

    const newExercises = target.exercises.map((ex) =>
      mapExerciseForPut(ex, localChanges.find((c) => c.exercise_template_id === ex.exercise_template_id))
    );
    await hevyPut(`/routines/${target.id}`, { routine: { title: target.title, exercises: newExercises } });

    const verifyData = await hevyGet(`/routines/${target.id}`);
    const { applied, mismatches } = diffApplied(target, verifyData.routine, localChanges);
    for (const entry of applied) propagated.push({ routine: target.title, ...entry });
    for (const m of mismatches) skipped.push({ routine: target.title, errors: [m] });
  }

  return { propagated, skipped };
}

async function restoreFromBackup(backupFile) {
  const raw = JSON.parse(readFileSync(backupFile, "utf8"));
  const routine = raw.routine ?? raw;
  const body = {
    routine: {
      title: routine.title,
      exercises: routine.exercises.map((ex) => mapExerciseForPut(ex, null)),
    },
  };
  const result = await hevyPut(`/routines/${routine.id}`, body);
  console.log(JSON.stringify({ ok: true, restored: true, routine_id: routine.id }, null, 2));
  return result;
}

async function main() {
  const args = process.argv.slice(2);

  const restoreIdx = args.indexOf("--restore");
  if (restoreIdx !== -1) {
    const backupFile = args[restoreIdx + 1];
    await restoreFromBackup(backupFile);
    return;
  }

  const dryRun = args.includes("--dry-run");
  const changeSetFile = args.find((a) => !a.startsWith("--"));
  if (!changeSetFile) {
    console.error("Usage: node coach/routine-write.mjs <change-set.json> [--dry-run]");
    process.exit(1);
  }

  const changeSet = JSON.parse(readFileSync(changeSetFile, "utf8"));
  const { routine_id, changes } = changeSet;

  if (!routine_id || !Array.isArray(changes)) {
    console.error(JSON.stringify({ ok: false, error: "change-set invalide: routine_id ou changes manquant" }));
    process.exit(2);
  }

  const liveData = await hevyGet(`/routines/${routine_id}`);
  const live = liveData.routine;

  // Backup avant toute écriture (même en dry-run, pour trace).
  const bkPath = backupPath(routine_id);
  writeFileSync(bkPath, JSON.stringify(liveData, null, 2));

  const errors = [];
  for (const change of changes) {
    const liveEx = live.exercises.find((e) => e.exercise_template_id === change.exercise_template_id);
    if (!liveEx) {
      errors.push(`exercise_template_id inconnu dans la routine: ${change.exercise_template_id}`);
      continue;
    }
    errors.push(...validateChange(change, liveEx));
  }

  if (errors.length > 0) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(2);
  }

  const newExercises = live.exercises.map((liveEx) => {
    const change = changes.find((c) => c.exercise_template_id === liveEx.exercise_template_id);
    return mapExerciseForPut(liveEx, change);
  });

  if (live.exercises.length !== newExercises.length) {
    console.error(JSON.stringify({ ok: false, errors: ["nombre d'exercices modifié, refusé"] }, null, 2));
    process.exit(2);
  }
  for (let i = 0; i < live.exercises.length; i++) {
    if (live.exercises[i].sets.length !== newExercises[i].sets.length) {
      console.error(JSON.stringify({ ok: false, errors: [`nombre de sets modifié pour ${live.exercises[i].title}, refusé`] }, null, 2));
      process.exit(2);
    }
  }

  if (dryRun) {
    const diffLines = [];
    for (const change of changes) {
      const liveEx = live.exercises.find((e) => e.exercise_template_id === change.exercise_template_id);
      const currentTop = liveEx.sets.reduce((b, s) => Math.max(b, s.weight_kg ?? 0), 0);
      if (change.target_weight_kg !== undefined) {
        diffLines.push(`${liveEx.title}: ${currentTop}kg -> ${change.target_weight_kg}kg`);
      }
      if (change.notes !== undefined) {
        diffLines.push(`${liveEx.title} notes: "${liveEx.notes}" -> "${change.notes}"`);
      }
    }
    const echo = await propagate(live, changes, { dryRun: true });
    console.log(JSON.stringify({ ok: true, dry_run: true, diff: diffLines, ...echo }, null, 2));
    return;
  }

  const putBody = { routine: { title: live.title, exercises: newExercises } };
  await hevyPut(`/routines/${routine_id}`, putBody);

  const verifyData = await hevyGet(`/routines/${routine_id}`);
  const { applied, mismatches } = diffApplied(live, verifyData.routine, changes);

  // La routine du jour est écrite et vérifiée : la propagation qui suit ne peut
  // plus faire échouer ce run, seulement ajouter des lignes au rapport.
  let propagated = [];
  let skipped = [];
  try {
    ({ propagated, skipped } = await propagate(live, changes, { dryRun: false }));
  } catch (err) {
    skipped.push({ errors: [`propagation interrompue: ${String(err?.message ?? err)}`] });
  }

  const verifiedOutPath = changeSetFile.replace(/\.json$/, "") + ".verified.json";
  writeFileSync(
    verifiedOutPath,
    JSON.stringify({ ok: mismatches.length === 0, applied, mismatches, propagated, skipped }, null, 2)
  );

  if (mismatches.length > 0) {
    console.error(JSON.stringify({ ok: false, applied, mismatches, propagated, skipped }, null, 2));
    process.exit(3);
  }

  console.log(JSON.stringify({ ok: true, applied, mismatches: [], propagated, skipped }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
