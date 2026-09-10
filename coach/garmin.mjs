// Client de l'API Garmin locale (garmin-api sur lepetek). Aucune dépendance.
const BASE = process.env.GARMIN_API_BASE ?? "http://192.168.1.33:8000";

const RUN_TYPES = new Set(["running", "treadmill_running"]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(pathAndQuery) {
  const backoffs = [1000, 3000];
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(`${BASE}${pathAndQuery}`, { headers: { accept: "application/json" } });
      if (res.ok) return res.json();
      if (res.status >= 500 && attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      throw new Error(`garmin-api ${pathAndQuery} -> ${res.status}`);
    } catch (err) {
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      throw err;
    }
  }
}

// L'API renvoie "2026-08-21 10:03:41" SANS fuseau : c'est l'heure LOCALE de la course.
export function parseLocal(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(ts);
  if (!m) return new Date(ts);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// Le champ s'appelle temperature_c mais les valeurs sont en Fahrenheit
// (72-84 avec 88 % d'humidité à Nice en août ; en °C ce serait absurde).
export function fToC(f) {
  return f == null ? null : Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

export function isRun(activity) {
  return RUN_TYPES.has(activity.type);
}

// limit s'applique AVANT le filtre de type : prendre large pour couvrir le bloc.
export async function listActivities(limit = 100) {
  const data = await getJson(`/activities?limit=${limit}`);
  return data.activities ?? [];
}

export async function listRuns(limit = 100) {
  return (await listActivities(limit)).filter(isRun);
}

export const getActivity = (id) => getJson(`/activities/${id}`);
export const getWeather = (id) => getJson(`/activities/${id}/weather`).catch(() => null);
export const getSplits = (id) => getJson(`/activities/${id}/splits`).catch(() => null);
export const getStats = (date) => getJson(`/stats/${date}`).catch(() => null);
// Série temporelle : indispensable pour les splits/km et le découplage cardiaque.
// Les laps Garmin ne servent à rien quand la sortie n'a pas d'auto-lap (lap_count === 1).
export const getStream = (id, points = 1500) =>
  getJson(`/activities/${id}/stream?points=${points}`).catch(() => null);

// Métriques Garmin déjà calculées : elles répondent directement à « est-ce que ça paie ».
export const getRacePredictions = () => getJson(`/metrics/race-predictions`).catch(() => null);
export const getVo2max = (date) => getJson(`/metrics/${date}/vo2max`).catch(() => null);
export const getEndurance = (date) => getJson(`/metrics/${date}/endurance`).catch(() => null);
