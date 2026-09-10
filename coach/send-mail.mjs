import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TO = "arnaud.sirech@gmail.com";

async function sendViaGws({ to, subject, html, dryRun }) {
  const args = [
    "gmail", "+send",
    "--to", to,
    "--subject", subject,
    "--body", html,
    "--html",
  ];
  if (dryRun) args.push("--dry-run");

  const { stdout, stderr } = await execFileAsync("gws", args, { maxBuffer: 10 * 1024 * 1024 });
  return { stdout, stderr };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (args.includes("--test")) {
    const result = await sendViaGws({
      to: TO,
      subject: "Test coach Hevy",
      html: "<p>Ceci est un email de test du coach Hevy automatique.</p>",
      dryRun,
    });
    console.log(result.stdout || "envoyé (test)");
    return;
  }

  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: node coach/send-mail.mjs <email.json> [--dry-run]  |  --test");
    process.exit(1);
  }

  const email = JSON.parse(readFileSync(file, "utf8"));
  const { subject, html } = email;
  if (!subject || !html) {
    console.error(JSON.stringify({ ok: false, error: "email.json doit contenir subject et html" }));
    process.exit(1);
  }

  const result = await sendViaGws({ to: TO, subject, html, dryRun });

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, gws_output: result.stdout }, null, 2));
    return;
  }

  const updated = { ...email, sent: true, sent_at: new Date().toISOString() };
  writeFileSync(file, JSON.stringify(updated, null, 2));
  console.log(JSON.stringify({ ok: true, sent: true }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.stderr || err?.message || err) }, null, 2));
  process.exit(1);
});
