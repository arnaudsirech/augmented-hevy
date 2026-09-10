import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./hevy.mjs";
import { listRuns, parseLocal } from "./garmin.mjs";
import { buildRunDossier } from "./run-dossier.mjs";
import { backoffForStatus, isWaiting } from "./backoff.mjs";
import { runCoachWithFallback } from "./runner.mjs";

const STATE_DIR = path.join(ROOT, "coach", "state");
const CURSOR_PATH = path.join(STATE_DIR, "runs-cursor.json");
const LOG_DIR = path.join(STATE_DIR, "logs");
// Garmin publie la sortie à la synchro de la montre : petite marge pour que tout soit remonté.
const QUIET_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function ensureDirs() {
  for (const d of [STATE_DIR, LOG_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function logLine(msg) {
  const line = `[${new Date().toISOString()}] [runs] ${msg}`;
  console.log(line);
  appendFileSync(path.join(LOG_DIR, `poll-${new Date().toISOString().slice(0, 10)}.log`), line + "\n");
}

const loadCursor = () =>
  existsSync(CURSOR_PATH)
    ? JSON.parse(readFileSync(CURSOR_PATH, "utf8"))
    : { since: new Date().toISOString(), processed: {} };

const saveCursor = (c) => writeFileSync(CURSOR_PATH, JSON.stringify(c, null, 2));

function emailWasSent(runId) {
  const p = path.join(STATE_DIR, `out-run-${runId}.email.json`);
  if (!existsSync(p)) return false;
  try {
    return JSON.parse(readFileSync(p, "utf8")).sent === true;
  } catch {
    return false;
  }
}

function cleanStaleFiles(runId) {
  const stale = path.join(STATE_DIR, `out-run-${runId}.email.json`);
  if (existsSync(stale)) rmSync(stale);
}

async function processRun(run, { dryRun, cursor }) {
  logLine(`traitement run ${run.id} (${run.name}, ${run.start_time})`);

  cleanStaleFiles(run.id);
  await buildRunDossier(run);

  const prompt =
    readFileSync(path.join(ROOT, "coach", "prompts", "analyse-run.md"), "utf8") +
    `\n\nDOSSIER=coach/state/run-dossier-${run.id}.json` +
    `\nRUN_ID=${run.id}` +
    (dryRun ? `\nDRY_RUN=1` : ``);

  const already = cursor.processed[run.id];
  const now = Date.now();
  const claudeWaiting = isWaiting(already, now);

  const result = await runCoachWithFallback({
    prompt,
    logLine,
    isEmailSent: () => (dryRun ? true : emailWasSent(run.id)),
    cleanStale: () => cleanStaleFiles(run.id),
    skipClaude: claudeWaiting,
  });

  const attempts = (cursor.processed[run.id]?.attempts ?? 0) + 1;

  if (!result.ok) {
    const wait = backoffForStatus(result.claudeResult?.apiStatus) ?? 15 * 60 * 1000;
    const retryAfter = new Date(Date.now() + wait).toISOString();
    logLine(`ECHEC analyse (Claude + Gemini) pour ${run.id} (tentative ${attempts}) — retry après ${retryAfter}`);
    cursor.processed[run.id] = {
      ...(cursor.processed[run.id] ?? {}),
      start_time: run.start_time,
      retry_after: retryAfter,
      gemini_failed: true,
      attempts,
    };
    return false;
  }

  if (dryRun) {
    logLine(`dry-run OK (${result.engine}) pour ${run.id}, curseur non avancé`);
    return true;
  }

  logLine(`SUCCES (${result.engine}${result.fallback ? " [fallback]" : ""}) pour ${run.id}`);
  cursor.processed[run.id] = {
    start_time: run.start_time,
    analysed_at: new Date().toISOString(),
    engine: result.engine,
    attempts,
  };
  delete cursor.processed[run.id].retry_after;
  delete cursor.processed[run.id].gemini_failed;
  return true;
}

async function main() {
  ensureDirs();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const runIdx = args.indexOf("--run");
  const specificRunId = runIdx !== -1 ? args[runIdx + 1] : null;

  if (args.includes("--init-cursor")) {
    saveCursor({ since: new Date().toISOString(), processed: {} });
    logLine(`curseur initialisé à maintenant`);
    return;
  }

  const cursor = loadCursor();
  const all = await listRuns(100);
  const candidates = specificRunId ? all.filter((r) => String(r.id) === String(specificRunId)) : all;

  if (specificRunId && candidates.length === 0) {
    logLine(`run ${specificRunId} introuvable dans les 100 dernières activités`);
    return;
  }

  const now = Date.now();
  const toProcess = [];

  for (const run of candidates) {
    const already = cursor.processed[run.id];
    const succeeded = already?.analysed_at != null;

    if (succeeded && !force) {
      logLine(`déjà analysé: ${run.id}`);
      continue;
    }
    if (isWaiting(already, now) && !force) {
      if (already.gemini_failed) {
        logLine(`en attente jusqu'à ${already.retry_after}: ${run.id} (Claude et Gemini ont échoué)`);
        continue;
      }
      logLine(`reprise via fallback Gemini: ${run.id} (quota Claude en attente jusqu'à ${already.retry_after})`);
    }
    if (already && !succeeded && (already.attempts ?? 0) >= MAX_ATTEMPTS && !force) {
      logLine(`ERROR abandon: ${run.id} a échoué ${already.attempts} fois`);
      continue;
    }
    if (!specificRunId) {
      const startMs = parseLocal(run.start_time).getTime();
      // Antériorité : ne jamais rattraper l'historique au premier démarrage.
      if (startMs < Date.parse(cursor.since)) continue;
      const endMs = startMs + (run.duration_s ?? 0) * 1000;
      if (now - endMs < QUIET_WINDOW_MS) {
        logLine(`skip (synchro récente): ${run.id}`);
        continue;
      }
    }
    toProcess.push(run);
  }

  toProcess.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));

  if (toProcess.length === 0) {
    logLine("aucune nouvelle sortie à traiter");
    return;
  }

  for (const run of toProcess) {
    await processRun(run, { dryRun, cursor });
    if (!dryRun) saveCursor(cursor);
  }
}

main().catch((err) => {
  logLine(`ERREUR FATALE: ${err?.stack ?? err}`);
  process.exit(1);
});
