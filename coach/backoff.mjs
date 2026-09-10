// Distingue les échecs "transitoires" (à retenter vite) des échecs "à attendre".
// La sortie de `claude -p --output-format json` porte api_error_status :
//   429 = quota/rate limit  -> inutile de brûler des tentatives, il faut attendre
//   401 = token OAuth expiré -> demande une action humaine (claude /login)
const BACKOFF_MS = {
  429: 2 * 60 * 60 * 1000, // 2 h
  401: 60 * 60 * 1000, // 1 h, et log bruyant : il faut se reconnecter
};

export function apiErrorStatus(stdout) {
  if (!stdout) return null;
  try {
    const s = JSON.parse(stdout).api_error_status;
    if (s != null) return Number(s);
  } catch {
    // sortie non-JSON (warning en préfixe, JSON tronqué) : on retombe sur une regex
  }
  const m = /"api_error_status"\s*:\s*(\d{3})/.exec(stdout);
  return m ? Number(m[1]) : null;
}

// Renvoie la durée d'attente, ou null si l'échec doit compter comme une tentative normale.
export function backoffForStatus(status) {
  return status == null ? null : BACKOFF_MS[status] ?? null;
}

export function isWaiting(entry, now = Date.now()) {
  return entry?.retry_after != null && Date.parse(entry.retry_after) > now;
}
