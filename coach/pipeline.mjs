import { execFile } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, envValue } from "./hevy.mjs";

// Le modèle ne fait que décider (prescription, email) via Decisionerr, sans aucun outil.
// Écriture de la routine, envoi du mail et journal restent ici, dans le code.

const STATE_DIR = path.join(ROOT, "coach", "state");
const DECIDE_TIMEOUT_MS = 25 * 60 * 1000;
const DEFAULT_RETRY_MS = 15 * 60 * 1000;

const line = { type: "string", minLength: 1 };
const EMAIL = {
  type: "object",
  properties: { subject: line, html: line, text: line },
  required: ["subject", "html", "text"],
  additionalProperties: false,
};
const strict = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const ROUTINE_SCHEMA = strict({
  routine_id: line,
  changes: {
    type: "array",
    items: {
      type: "object",
      properties: {
        exercise_template_id: line,
        target_weight_kg: { type: "number", exclusiveMinimum: 0 },
        target_reps: {
          anyOf: [
            { type: "integer", minimum: 1 },
            { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1 },
          ],
        },
        notes: line,
      },
      required: ["exercise_template_id"],
      additionalProperties: false,
    },
  },
});
export const SEANCE_EMAIL_SCHEMA = strict({
  email: EMAIL,
  journal: strict({ constat: line, changements: line, a_verifier: line }),
});
export const RUN_EMAIL_SCHEMA = strict({
  email: EMAIL,
  journal: strict({ titre: line, constat: line, forme: line, bloc: line }),
});

export function isWaiting(entry, now = Date.now()) {
  return entry?.retry_after != null && Date.parse(entry.retry_after) > now;
}

/** Délai avant de retenter après un échec : celui que Decisionerr donne, sinon 15 min. */
export function retryDelayMs(error) {
  return error?.retryAfterMs ?? DEFAULT_RETRY_MS;
}

const prompt = (name) => readFileSync(path.join(ROOT, "coach", "prompts", name), "utf8");

async function decide(payload) {
  const url = envValue("DECISIONERR_URL") ?? "http://127.0.0.1:8790";
  const token = envValue("DECISIONERR_TOKEN");
  if (!token) throw new Error(`DECISIONERR_TOKEN absent de ${path.join(ROOT, ".env")}`);
  const res = await fetch(`${url}/v1/decide`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DECIDE_TIMEOUT_MS),
  });
  const body = await res.json();
  if (res.status === 200) return body;
  const error = new Error(`decisionerr ${res.status} ${body.error}${body.detail ? ` — ${body.detail}` : ""}`);
  if (body.retry_after) error.retryAfterMs = body.retry_after * 1000;
  throw error;
}

// send-mail.mjs appelle `gws`, installé dans ~/.npm-global/bin, hors du PATH de systemd.
const SCRIPT_ENV = {
  ...process.env,
  PATH: `${os.homedir()}/.local/bin:${os.homedir()}/.npm-global/bin:${process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"}`,
};

function runScript(script, args) {
  return new Promise((resolve) => {
    const options = { cwd: ROOT, env: SCRIPT_ENV };
    execFile(process.execPath, [path.join(ROOT, "coach", script), ...args], options, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

async function sendEmail(fileName, email, dryRun) {
  const file = path.join(STATE_DIR, fileName);
  writeFileSync(file, JSON.stringify(email, null, 2));
  const out = await runScript("send-mail.mjs", [file, ...(dryRun ? ["--dry-run"] : [])]);
  if (out.code !== 0) throw new Error(`send-mail exit ${out.code}: ${out.stderr.slice(0, 500)}`);
  if (!dryRun && parseJson(readFileSync(file, "utf8"))?.sent !== true) {
    throw new Error("send-mail n'a pas confirmé l'envoi");
  }
}

/** Prescription + écriture de la routine, avec une correction si le validateur refuse. */
async function prescribe({ workoutId, dossier, dryRun, logLine }) {
  const file = path.join(STATE_DIR, `out-${workoutId}.routine.json`);
  let input = { dossier };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await decide({
      task: "seance_routine",
      tier: "best",
      system: prompt("seance-routine.md"),
      input,
      schema: ROUTINE_SCHEMA,
    });
    logLine(`prescription via ${res.provider} (${res.model}, ${res.latency_ms} ms) : ${res.reason}`);
    writeFileSync(file, JSON.stringify(res.decision, null, 2));

    const out = await runScript("routine-write.mjs", [file, ...(dryRun ? ["--dry-run"] : [])]);
    const result = parseJson(out.stdout) ?? parseJson(out.stderr);
    if (out.code === 0) return result;
    if (out.code === 3) {
      logLine(`routine-write : écriture non confirmée (${JSON.stringify(result?.mismatches ?? out.stderr).slice(0, 300)})`);
      return result;
    }
    if (out.code !== 2) throw new Error(`routine-write exit ${out.code}: ${out.stderr.slice(0, 500)}`);

    const errors = result?.errors ?? [result?.error ?? out.stderr.slice(0, 500)];
    logLine(`routine-write a refusé la prescription (tentative ${attempt}) : ${errors.join(" | ")}`);
    if (attempt === 2) return { ok: false, errors };
    input = { dossier, change_set_precedent: res.decision, rejet: { errors } };
  }
}

export async function runSeance({ workout, dryRun, logLine }) {
  const dossier = JSON.parse(readFileSync(path.join(STATE_DIR, `dossier-${workout.id}.json`), "utf8"));
  const routineWrite = dossier.routine ? await prescribe({ workoutId: workout.id, dossier, dryRun, logLine }) : null;

  const res = await decide({
    task: "seance_email",
    tier: "best",
    system: prompt("seance-email.md"),
    input: { dossier, routine_write: routineWrite, dry_run: dryRun },
    schema: SEANCE_EMAIL_SCHEMA,
  });
  logLine(`email via ${res.provider} (${res.model}, ${res.latency_ms} ms)`);
  await sendEmail(`out-${workout.id}.email.json`, res.decision.email, dryRun);

  if (!dryRun) {
    const { constat, changements, a_verifier } = res.decision.journal;
    appendFileSync(
      path.join(ROOT, "coach", "journal.md"),
      `\n## ${new Date().toISOString().slice(0, 10)} — ${workout.title}\n` +
        `- Constat : ${constat}\n- Changements : ${changements}\n- À vérifier la prochaine fois : ${a_verifier}\n`,
    );
  }
  return { engine: `${res.provider}:${res.model}` };
}

export async function runRun({ run, dryRun, logLine }) {
  const dossier = JSON.parse(readFileSync(path.join(STATE_DIR, `run-dossier-${run.id}.json`), "utf8"));
  const res = await decide({
    task: "run_email",
    tier: "best",
    system: prompt("run-email.md"),
    input: { dossier },
    schema: RUN_EMAIL_SCHEMA,
  });
  logLine(`email via ${res.provider} (${res.model}, ${res.latency_ms} ms)`);
  await sendEmail(`out-run-${run.id}.email.json`, res.decision.email, dryRun);

  if (!dryRun) {
    const { titre, constat, forme, bloc } = res.decision.journal;
    appendFileSync(
      path.join(ROOT, "coach", "journal-runs.md"),
      `\n## ${String(run.start_time).slice(0, 10)} — ${titre}\n` +
        `- Constat : ${constat}\n- Découplage / forme : ${forme}\n- Bloc : ${bloc}\n`,
    );
  }
  return { engine: `${res.provider}:${res.model}` };
}
