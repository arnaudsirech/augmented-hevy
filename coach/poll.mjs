import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT, hevyGet, fetchPages } from "./hevy.mjs";
import { buildDossier } from "./dossier.mjs";
import { isWaiting, retryDelayMs, runSeance } from "./pipeline.mjs";

const STATE_DIR = path.join(ROOT, "coach", "state");
const CURSOR_PATH = path.join(STATE_DIR, "cursor.json");
const LOG_DIR = path.join(STATE_DIR, "logs");
const QUIET_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function ensureDirs() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  const logFile = path.join(LOG_DIR, `poll-${new Date().toISOString().slice(0, 10)}.log`);
  appendFileSync(logFile, line + "\n");
}

function loadCursor() {
  if (!existsSync(CURSOR_PATH)) {
    return { since: new Date().toISOString(), processed: {} };
  }
  return JSON.parse(readFileSync(CURSOR_PATH, "utf8"));
}

function saveCursor(cursor) {
  writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2));
}

async function fetchUpdatedWorkoutsSince(since) {
  const events = await fetchPages(`/workouts/events?since=${encodeURIComponent(since)}`, "events", {
    pageSize: 10,
    maxPages: 6,
  });
  return events.filter((e) => e.type === "updated").map((e) => e.workout);
}

function cleanStaleFiles(workoutId) {
  for (const suffix of ["email.json", "routine.json", "routine.verified.json"]) {
    const stale = path.join(STATE_DIR, `out-${workoutId}.${suffix}`);
    if (existsSync(stale)) rmSync(stale);
  }
}

async function processWorkout(workout, { dryRun, cursor }) {
  logLine(`traitement workout ${workout.id} (${workout.title}, ${workout.start_time})`);

  cleanStaleFiles(workout.id);
  await buildDossier(workout);

  const attempts = (cursor.processed[workout.id]?.attempts ?? 0) + 1;

  let result;
  try {
    result = await runSeance({ workout, dryRun, logLine });
  } catch (error) {
    const retryAfter = new Date(Date.now() + retryDelayMs(error)).toISOString();
    logLine(`ECHEC analyse pour ${workout.id} (tentative ${attempts}) : ${error.message} — nouvelle tentative après ${retryAfter}`);
    cursor.processed[workout.id] = {
      ...(cursor.processed[workout.id] ?? {}),
      updated_at: workout.updated_at,
      retry_after: retryAfter,
      attempts,
    };
    return false;
  }

  if (dryRun) {
    logLine(`dry-run OK (${result.engine}) pour ${workout.id}, curseur non avancé`);
    return true;
  }

  logLine(`SUCCES (${result.engine}) pour ${workout.id}`);
  cursor.processed[workout.id] = {
    updated_at: workout.updated_at,
    analysed_at: new Date().toISOString(),
    engine: result.engine,
    attempts,
  };
  return true;
}

async function main() {
  ensureDirs();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const initCursor = args.includes("--init-cursor");
  const workoutIdx = args.indexOf("--workout");
  const specificWorkoutId = workoutIdx !== -1 ? args[workoutIdx + 1] : null;

  if (initCursor) {
    const cursor = { since: new Date().toISOString(), processed: {} };
    saveCursor(cursor);
    logLine(`curseur initialisé à ${cursor.since}`);
    return;
  }

  const cursor = loadCursor();

  let candidates;
  if (specificWorkoutId) {
    const workout = await hevyGet(`/workouts/${specificWorkoutId}`);
    candidates = [workout];
  } else {
    candidates = await fetchUpdatedWorkoutsSince(cursor.since);
  }

  const now = Date.now();
  const toProcess = [];
  // updated_at des workouts encore en attente : ils doivent retenir le curseur, sinon ils
  // sortent de la fenêtre ?since= et ne reviennent jamais.
  const blockers = [];

  for (const workout of candidates) {
    const already = cursor.processed[workout.id];
    // Seul un analysed_at prouve que le run est allé au bout (routine écrite + email parti).
    // Une entrée sans analysed_at est un échec à retenter, pas une séance déjà traitée.
    const succeeded = already?.analysed_at != null;

    if (succeeded && !force) {
      logLine(`re-edit ignoré: ${workout.id} déjà analysé le ${already.analysed_at}`);
      continue;
    }
    if (isWaiting(already, now) && !force) {
      logLine(`en attente jusqu'à ${already.retry_after}: ${workout.id}`);
      blockers.push(workout.updated_at);
      continue;
    }
    if (already && !succeeded && (already.attempts ?? 0) >= MAX_ATTEMPTS && !force) {
      // Abandon définitif : on ne le compte plus comme blocker, sinon le curseur gèlerait.
      logLine(`ERROR abandon: ${workout.id} a échoué ${already.attempts} fois, ignoré`);
      continue;
    }
    const age = now - Date.parse(workout.updated_at);
    if (!specificWorkoutId && age < QUIET_WINDOW_MS) {
      logLine(`skip (fenêtre de calme): ${workout.id}, modifié il y a ${Math.round(age / 1000)}s`);
      blockers.push(workout.updated_at);
      continue;
    }
    toProcess.push(workout);
  }

  toProcess.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));

  if (toProcess.length === 0) {
    logLine("aucun nouveau workout à traiter");
    return;
  }

  let maxProcessedUpdatedAt = null;

  for (const workout of toProcess) {
    const success = await processWorkout(workout, { dryRun, cursor });
    if (dryRun) continue;
    saveCursor(cursor);

    if (success) {
      if (!maxProcessedUpdatedAt || workout.updated_at > maxProcessedUpdatedAt) {
        maxProcessedUpdatedAt = workout.updated_at;
      }
    } else if ((cursor.processed[workout.id]?.attempts ?? 0) < MAX_ATTEMPTS) {
      // Échec retentable : le curseur doit rester en deçà pour le retrouver au prochain tick.
      blockers.push(workout.updated_at);
    }
  }

  if (!dryRun && !specificWorkoutId) {
    // Ne jamais dépasser le plus ancien workout encore en attente (retry ou fenêtre de
    // calme) ; sinon on avance jusqu'au plus récent succès.
    const oldestBlocker = blockers.length ? blockers.reduce((a, b) => (a < b ? a : b)) : null;
    const target = oldestBlocker ?? maxProcessedUpdatedAt;
    if (target) {
      const newSince = new Date(Date.parse(target) - 60_000).toISOString();
      if (newSince > cursor.since) {
        cursor.since = newSince;
        saveCursor(cursor);
        logLine(`curseur avancé à ${cursor.since}`);
      }
    }
  }
}

main().catch((err) => {
  logLine(`ERREUR FATALE: ${err?.stack ?? err}`);
  process.exit(1);
});
