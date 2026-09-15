import { spawn } from "node:child_process";
import os from "node:os";
import { ROOT } from "./hevy.mjs";
import { apiErrorStatus } from "./backoff.mjs";

const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000;
// Le dossier running est lourd : `agy` clôturait à 5 min (« print timeout with turn in
// progress ») et rendait une sortie partielle, donc un échec — 15/09 sur 3 runs de suite.
const GEMINI_TIMEOUT_MS = 15 * 60 * 1000;
const GEMINI_PRINT_TIMEOUT = "15m";
export const GEMINI_MODEL = "gemini-3.8-flash-high";

function getEnv() {
  const home = os.homedir();
  return {
    ...process.env,
    PATH: `${home}/.local/bin:${home}/.npm-global/bin:${process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"}`,
    HOME: home,
  };
}

export function runClaude({ prompt, timeoutMs = CLAUDE_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      [
        "-p", prompt,
        "--permission-mode", "bypassPermissions",
        "--allowedTools", "Read,Write,Edit,Bash",
        "--output-format", "json",
        "--max-turns", "40",
      ],
      {
        cwd: ROOT,
        env: getEnv(),
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, timedOut: true, stdout, stderr, engine: "claude" });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        spawnError: true,
        stdout,
        stderr: `${stderr}\nspawn: ${err.message}`,
        engine: "claude",
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        apiStatus: apiErrorStatus(stdout),
        engine: "claude",
      });
    });
  });
}

export function runGemini({ prompt, timeoutMs = GEMINI_TIMEOUT_MS, model = GEMINI_MODEL }) {
  return new Promise((resolve) => {
    const child = spawn(
      "agy",
      [
        "--model", model,
        "--dangerously-skip-permissions",
        "--output-format", "json",
        "--print-timeout", GEMINI_PRINT_TIMEOUT,
        "--print",
        prompt,
      ],
      {
        cwd: ROOT,
        env: getEnv(),
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, timedOut: true, stdout, stderr, engine: model });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        spawnError: true,
        stdout,
        stderr: `${stderr}\nspawn: ${err.message}`,
        engine: model,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      let isError = false;
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.status && parsed.status !== "SUCCESS") {
          isError = true;
        }
      } catch {}
      resolve({
        ok: code === 0 && !isError,
        code,
        stdout,
        stderr,
        engine: model,
      });
    });
  });
}

/**
 * Exécute Claude en priorité. Si Claude échoue (quota 429, erreur API, crash,
 * timeout ou email non envoyé), bascule automatiquement sur Gemini 3.8 Flash.
 */
export async function runCoachWithFallback({
  prompt,
  logLine,
  isEmailSent,
  cleanStale,
  skipClaude = false,
}) {
  let claudeResult = null;

  if (!skipClaude) {
    logLine("lancement analyse avec Claude...");
    claudeResult = await runClaude({ prompt });

    if (claudeResult.stdout) logLine(`claude stdout: ${claudeResult.stdout.slice(0, 1500)}`);
    if (claudeResult.stderr) logLine(`claude stderr: ${claudeResult.stderr.slice(0, 800)}`);

    if (claudeResult.ok && isEmailSent()) {
      return {
        ok: true,
        engine: "claude",
        fallback: false,
        result: claudeResult,
      };
    }

    const reason = claudeResult.apiStatus
      ? `statut API ${claudeResult.apiStatus}`
      : claudeResult.timedOut
      ? "timeout"
      : claudeResult.spawnError
      ? "erreur spawn"
      : !claudeResult.ok
      ? `exit code ${claudeResult.code}`
      : "email non confirmé";

    logLine(`ÉCHEC Claude (${reason}) -> bascule fallback vers Gemini 3.8 (${GEMINI_MODEL})...`);
  } else {
    logLine(`Claude ignoré (quota actif) -> lancement direct avec Gemini 3.8 (${GEMINI_MODEL})...`);
  }

  // Nettoyage des éventuels fichiers partiels laissés par Claude avant de démarrer Gemini
  if (cleanStale) cleanStale();

  const geminiResult = await runGemini({ prompt });
  if (geminiResult.stdout) logLine(`gemini stdout: ${geminiResult.stdout.slice(0, 1500)}`);
  if (geminiResult.stderr) logLine(`gemini stderr: ${geminiResult.stderr.slice(0, 800)}`);

  if (geminiResult.ok && isEmailSent()) {
    logLine(`SUCCÈS analyse via fallback Gemini 3.8 (${GEMINI_MODEL})`);
    return {
      ok: true,
      engine: GEMINI_MODEL,
      fallback: true,
      result: geminiResult,
      claudeResult,
    };
  }

  const geminiReason = geminiResult.timedOut
    ? "timeout"
    : geminiResult.spawnError
    ? "erreur spawn"
    : !geminiResult.ok
    ? `exit code ${geminiResult.code}`
    : "email non confirmé";

  logLine(`ÉCHEC Gemini 3.8 (${geminiReason})`);

  return {
    ok: false,
    engine: "both",
    fallback: true,
    claudeResult,
    geminiResult,
  };
}
