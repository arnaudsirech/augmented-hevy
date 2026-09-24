// Plafond 12 reps par série depuis ~21/08/2026, sauf les exercices listés ici,
// qui progressent par les REPS jusqu'au haut de leur fourchette puis +1 cran de
// charge. Décisions : élévations latérales le 22/09/2026, calf press le 24/09/2026.
export const DEFAULT_REP_CAP = 12;

export const HIGH_REP_EXERCISES = {
  BE289E45: { title: "Lateral Raise (Cable)", range: [15, 25] },
  "422B08F1": { title: "Lateral Raise (Dumbbell)", range: [15, 25] },
  "91237BDD": { title: "Calf Press (Machine)", range: [15, 20] },
};

export function repCeiling(exerciseTemplateId) {
  return HIGH_REP_EXERCISES[exerciseTemplateId]?.range[1] ?? DEFAULT_REP_CAP;
}

export function isRepProgression(exerciseTemplateId) {
  return exerciseTemplateId in HIGH_REP_EXERCISES;
}

// Ligne 1 d'une note : "3x8-12 @ 40kg" -> { sets: 3, min: 8, max: 12 }.
export function parseNoteRange(notes) {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)(?:-(\d+))?/i.exec((notes ?? "").split("\n")[0]);
  if (!m) return null;
  const min = Number(m[2]);
  return { sets: Number(m[1]), min, max: m[3] ? Number(m[3]) : min };
}
