import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./hevy.mjs";
import {
  listRuns, getActivity, getWeather, getSplits, getStats, getStream,
  getRacePredictions, getVo2max, getEndurance, parseLocal, fToC,
} from "./garmin.mjs";

// Repères marathon (cf. coach/context.md)
const LTHR = 187;
const MAX_HR = 208;
const BLOCK_START = "2026-07-20";
const RACE_DATE = "2026-11-08";

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

function paceMinPerKm(distance_m, duration_s) {
  if (!distance_m || !duration_s) return null;
  return duration_s / 60 / (distance_m / 1000);
}

export function paceLabel(pace) {
  if (pace == null) return null;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function summarizeRun(a) {
  const pace = paceMinPerKm(a.distance_m, a.duration_s);
  return {
    id: a.id,
    date: a.start_time.slice(0, 10),
    start_time: a.start_time,
    name: a.name,
    km: round((a.distance_m ?? 0) / 1000, 2),
    duration_min: round((a.duration_s ?? 0) / 60),
    pace: paceLabel(pace),
    pace_min_per_km: round(pace, 2),
    avg_hr: a.avg_hr ?? null,
    max_hr: a.max_hr ?? null,
    // Le repère utile est le %LTHR (c'est ce que sa montre utilise), pas le %FCmax.
    pct_lthr: a.avg_hr ? round((a.avg_hr / LTHR) * 100) : null,
    // EF = m/s par battement : à comparer à ses propres sorties, pas à d'autres coureurs.
    efficiency_factor:
      a.avg_hr && a.distance_m && a.duration_s
        ? round(a.distance_m / a.duration_s / a.avg_hr, 4)
        : null,
  };
}

function weekKey(dateStr) {
  const d = parseLocal(dateStr + "T00:00:00");
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function buildBlock(runs) {
  const inBlock = runs.filter((r) => r.date >= BLOCK_START);
  const byWeek = new Map();
  for (const r of inBlock) {
    const k = weekKey(r.date);
    if (!byWeek.has(k)) byWeek.set(k, { week_of: k, runs: 0, km: 0, sec: 0, hr: [] });
    const w = byWeek.get(k);
    w.runs++;
    w.km += r.km;
    w.sec += (r.duration_min ?? 0) * 60;
    if (r.avg_hr) w.hr.push(r.avg_hr);
  }
  const weeks = [...byWeek.values()]
    .sort((a, b) => (a.week_of < b.week_of ? -1 : 1))
    .map((w) => ({
      week_of: w.week_of,
      runs: w.runs,
      km: round(w.km),
      avg_hr: w.hr.length ? round(w.hr.reduce((s, x) => s + x, 0) / w.hr.length) : null,
      avg_pace: paceLabel(w.km ? w.sec / 60 / w.km : null),
    }));

  const daysToRace = Math.round((parseLocal(RACE_DATE + "T00:00:00") - Date.now()) / 86400000);
  return {
    block_start: BLOCK_START,
    race_date: RACE_DATE,
    days_to_race: daysToRace,
    weeks_to_race: Math.round(daysToRace / 7),
    total_runs: inBlock.length,
    total_km: round(inBlock.reduce((s, r) => s + r.km, 0)),
    weeks,
  };
}

function contextMd() {
  const p = path.join(ROOT, "coach", "context.md");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

function journalTail(n = 3) {
  const p = path.join(ROOT, "coach", "journal-runs.md");
  if (!existsSync(p)) return "";
  const entries = readFileSync(p, "utf8").split(/^## /m).slice(1);
  return entries.slice(-n).map((e) => "## " + e.trim()).join("\n\n");
}

// ---- Analyse de la série temporelle : splits/km, découplage cardiaque, dénivelé ----

// Découpe le flux en kilomètres pleins. Garmin ne fournit des laps que si l'auto-lap est
// activé (lap_count === 1 sur ses sorties), donc on les reconstruit ici.
function kmSplits(series) {
  const pts = series.filter((p) => p.dist_m != null && p.t_s != null);
  if (pts.length < 2) return [];
  const splits = [];
  let km = 1;
  let startIdx = 0;

  for (let i = 1; i < pts.length; i++) {
    if (pts[i].dist_m < km * 1000) continue;
    const seg = pts.slice(startIdx, i + 1);
    const dt = pts[i].t_s - pts[startIdx].t_s;
    const dd = pts[i].dist_m - pts[startIdx].dist_m;
    const hrs = seg.map((p) => p.hr).filter((h) => h != null);
    let gain = 0;
    for (let j = 1; j < seg.length; j++) {
      const d = (seg[j].elevation_m ?? 0) - (seg[j - 1].elevation_m ?? 0);
      if (d > 0) gain += d;
    }
    const gaps = seg.map((p) => p.gap_speed_mps).filter((v) => v != null && v > 0);
    splits.push({
      km,
      pace: paceLabel(dd > 0 ? dt / 60 / (dd / 1000) : null),
      gap_pace: paceLabel(gaps.length ? 1000 / (gaps.reduce((s, v) => s + v, 0) / gaps.length) / 60 : null),
      avg_hr: hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : null,
      pct_lthr: hrs.length ? round((hrs.reduce((s, h) => s + h, 0) / hrs.length / LTHR) * 100) : null,
      elev_gain_m: Math.round(gain),
    });
    startIdx = i;
    km++;
  }
  return splits;
}

// Découplage cardiaque (Pw:HR / Pa:HR) : rapport vitesse/FC sur la 1re moitié vs la 2e.
// > +5 % = la FC dérive pour la même allure -> endurance aérobie limitante ce jour-là.
// Calculé aussi en vitesse corrigée de la pente, car une bosse en fin de sortie fausse le brut.
function decoupling(series) {
  const pts = series.filter((p) => p.dist_m != null && p.hr && p.speed_mps > 0);
  if (pts.length < 20) return null;
  const halfDist = pts[pts.length - 1].dist_m / 2;
  const first = pts.filter((p) => p.dist_m <= halfDist);
  const second = pts.filter((p) => p.dist_m > halfDist);
  if (first.length < 10 || second.length < 10) return null;

  const ratio = (arr, key) => {
    const sp = arr.map((p) => p[key]).filter((v) => v != null && v > 0);
    const hr = arr.map((p) => p.hr).filter((v) => v != null && v > 0);
    if (!sp.length || !hr.length) return null;
    return sp.reduce((s, v) => s + v, 0) / sp.length / (hr.reduce((s, v) => s + v, 0) / hr.length);
  };

  const mk = (key) => {
    const r1 = ratio(first, key), r2 = ratio(second, key);
    return r1 && r2 ? round(((r1 - r2) / r1) * 100, 1) : null;
  };

  const avg = (arr, key) => {
    const v = arr.map((p) => p[key]).filter((x) => x != null && x > 0);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };

  return {
    pct: mk("speed_mps"),
    gap_pct: mk("gap_speed_mps"),
    first_half: { pace: paceLabel(1000 / avg(first, "speed_mps") / 60), avg_hr: Math.round(avg(first, "hr")) },
    second_half: { pace: paceLabel(1000 / avg(second, "speed_mps") / 60), avg_hr: Math.round(avg(second, "hr")) },
    note: "pct > 5 = FC qui derive; negatif = seconde moitie plus efficace",
  };
}


const hms = (s) =>
  s == null ? null : `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Barèmes d'interprétation. Ils vivent ici (et pas dans le prompt) pour que la notation soit
// stable d'un mail à l'autre au lieu de dépendre de l'humeur du modèle.
const SCALES = {
  decoupling: {
    what: "Derive du rapport allure/FC entre 1re et 2e moitie. Mesure la durabilite aerobie : capacite a tenir l allure sans que le coeur monte. C est LE marqueur d endurance marathon.",
    bands: [
      { max: 3, rating: "excellent", means: "aucune derive : l endurance tient tres bien sur la duree" },
      { max: 5, rating: "bon", means: "derive faible, base aerobie solide (seuil classique = 5 %)" },
      { max: 10, rating: "moyen", means: "la FC monte pour la meme allure : duree ou intensite au-dessus du confort du jour" },
      { max: 999, rating: "eleve", means: "grosse derive : chaleur, fatigue ou allure trop haute pour la distance" },
    ],
    caveat: "Sur une sortie vallonnee, lire la version GAP (corrigee de la pente) en priorite.",
  },
  efficiency_factor: {
    what: "EF = vitesse (m/s) / FC moyenne. Metres parcourus par battement. Ne se compare pas a d autres coureurs, seulement a soi dans le temps : s il monte a effort egal, la forme aerobie progresse.",
  },
  endurance_score: {
    what: "Score d endurance Garmin, avec les paliers officiels renvoyes par la montre (intermediate / trained / well_trained / expert / superior).",
  },
  race_prediction: {
    what: "Temps de course predits par Garmin d apres VO2max et historique. A comparer a son objectif marathon.",
  },
};

function rateDecoupling(pct) {
  if (pct == null) return null;
  const band = SCALES.decoupling.bands.find((b) => Math.abs(pct) <= b.max);
  // Un decouplage negatif = 2e moitie PLUS efficace : c est un bon signe, pas une derive.
  return { pct, rating: pct < 0 ? "excellent" : band.rating, means: pct < 0 ? "seconde moitie plus efficace que la premiere" : band.means };
}

export async function buildRunDossier(runListEntry) {
  const id = runListEntry.id;
  const [detail, weatherRaw, splitsRaw, streamRaw, allRuns] = await Promise.all([
    getActivity(id).catch(() => null),
    getWeather(id),
    getSplits(id),
    getStream(id),
    listRuns(100),
  ]);

  const runDate = runListEntry.start_time.slice(0, 10);
  const [stats, racePred, vo2Now, vo2Start, endurance] = await Promise.all([
    getStats(runDate),
    getRacePredictions(),
    getVo2max(runDate),
    getVo2max(BLOCK_START), // pour mesurer la progression depuis le debut du bloc
    getEndurance(runDate),
  ]);
  const d = detail ?? runListEntry;
  const pace = paceMinPerKm(d.distance_m, d.duration_s);

  const laps = splitsRaw?.laps ?? [];
  const series = streamRaw?.series ?? [];
  const weather = weatherRaw?.temperature_c == null
    ? null
    : {
        // conversion F -> C : l'API mal étiquette le champ (cf. garmin.mjs).
        // NE PAS utiliser avg_temperature_c du résumé : c'est le capteur du poignet, chauffé
        // par la peau — il lit 28-33 °C sur toutes les sorties, y compris une à 22 °C réels.
        temp_c: fToC(weatherRaw.temperature_c),
        // Le ressenti est le chiffre parlant à Nice (36,7 vs 31,1 °C bruts le 7/08).
        apparent_c: fToC(weatherRaw.apparent_temp_c),
        humidity_pct: weatherRaw.humidity_pct ?? null,
        wrist_sensor_c_unreliable: d.avg_temperature_c ?? null,
      };

  const previous = allRuns
    .filter((r) => r.id !== id && r.start_time < runListEntry.start_time)
    .slice(0, 5)
    .map(summarizeRun);

  const dossier = {
    generated_at: new Date().toISOString(),
    run: {
      ...summarizeRun({ ...runListEntry, ...d, start_time: runListEntry.start_time }),
      avg_cadence: round(d.avg_cadence),
      avg_stride_length_cm: round(d.avg_stride_length_cm),
      avg_ground_contact_time_ms: round(d.avg_ground_contact_time_ms),
      training_effect: round(d.training_effect, 1),
      anaerobic_training_effect: round(d.anaerobic_training_effect, 1),
      training_load: round(d.training_load),
      calories: d.calories ?? null,
      // workout_rpe / workout_feel sont sur une échelle 0-100 côté Garmin
      workout_rpe: d.workout_rpe ?? null,
      workout_feel: d.workout_feel ?? null,
      lap_count: d.lap_count ?? null,
    },
    // laps vide/unique = sortie continue : ne pas inventer de fractionné.
    // Les laps bruts ne donnent que avg_speed_mps : on précalcule l'allure pour que le
    // modèle n'ait pas à convertir (et ça allège le dossier sur un 21k auto-lappé).
    splits:
      laps.length > 1
        ? laps.map((l) => ({
            lap: l.lap,
            km: round((l.distance_m ?? 0) / 1000, 2),
            pace: paceLabel(paceMinPerKm(l.distance_m, l.duration_s)),
            avg_hr: l.avg_hr ?? null,
            max_hr: l.max_hr ?? null,
            avg_cadence: round(l.avg_cadence),
          }))
        : [],
    weather,
    day_stats: stats
      ? {
          resting_hr: stats.resting_hr,
          avg_stress: stats.avg_stress,
          body_battery_high: stats.body_battery_high,
          body_battery_low: stats.body_battery_low,
          steps: stats.steps,
        }
      : null,
    // Reconstruits depuis la série temporelle (cf. kmSplits/decoupling ci-dessus) : c'est
    // ce qui permet de parler du dernier km, d'une bosse ou d'une dérive cardiaque.
    km_splits: series.length ? kmSplits(series) : [],
    decoupling: series.length ? decoupling(series) : null,
    elevation: {
      gain_m: d.elevation_gain_m ?? null,
      loss_m: d.elevation_loss_m ?? null,
      max_m: d.max_elevation_m ?? null,
      min_m: d.min_elevation_m ?? null,
    },
    // GAP = allure corrigée de la pente : la vraie référence dès qu'il y a du dénivelé.
    gap_pace: paceLabel(
      d.avg_grade_adjusted_speed_mps ? 1000 / d.avg_grade_adjusted_speed_mps / 60 : null
    ),
    reference: {
      lthr: LTHR,
      max_hr: MAX_HR,
      threshold_pace: "3:57/km",
      note: "raisonner en %LTHR; LTHR 187 = allure seuil 3:57/km",
    },
    previous_runs: previous,
    block: buildBlock(allRuns.map(summarizeRun)),
    // Metriques Garmin deja calculees + bareme : c est ce qui permet de dire si ca paie.
    fitness: {
      vo2max_now: vo2Now?.vo2max ?? null,
      vo2max_block_start: vo2Start?.vo2max ?? null,
      vo2max_delta:
        vo2Now?.vo2max != null && vo2Start?.vo2max != null
          ? round(vo2Now.vo2max - vo2Start.vo2max, 1)
          : null,
      endurance_score: endurance?.score ?? null,
      endurance_thresholds: endurance?.thresholds ?? null,
      race_predictions: racePred
        ? {
            marathon: hms(racePred.time_marathon_s),
            half: hms(racePred.time_half_s),
            "10k": hms(racePred.time_10k_s),
            "5k": hms(racePred.time_5k_s),
          }
        : null,
      // EF de cette sortie, a comparer aux precedentes (calcule plus bas pour chacune)
      efficiency_factor: d.avg_hr && d.avg_speed_mps ? round(d.avg_speed_mps / d.avg_hr, 4) : null,
    },
    scales: SCALES,
    decoupling_rating: null, // rempli juste apres
    journal_tail: journalTail(3),
    context: contextMd(),
  };

  // Sur terrain vallonné, la version GAP est la plus fiable : c'est elle qu'on note.
  dossier.decoupling_rating = rateDecoupling(
    dossier.decoupling?.gap_pct ?? dossier.decoupling?.pct ?? null
  );

  const outPath = path.join(ROOT, "coach", "state", `run-dossier-${id}.json`);
  writeFileSync(outPath, JSON.stringify(dossier, null, 2));
  return { dossier, path: outPath };
}
