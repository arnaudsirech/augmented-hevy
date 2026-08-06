// Typed client for the augmented-hevy backend (server/). All shapes here mirror
// server/src/stats/*.ts and server/src/routes/*.ts exactly.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export interface WeeklyVolumePoint {
  week: string;
  volumeKg: number;
  workoutCount: number;
}

export interface StatsSummary {
  periodDays: number;
  workoutCount: number;
  totalVolumeKg: number;
  totalSets: number;
  avgWorkoutsPerWeek: number;
  currentStreakWeeks: number;
  lastWorkoutAt: string | null;
  weeklyVolume: WeeklyVolumePoint[];
}

export interface MuscleGroupVolume {
  muscleGroup: string;
  volumeKg: number;
  sets: number;
}

export interface BodyMeasurement {
  id?: string;
  date: string;
  weight_kg: number | null;
  lean_mass_kg: number | null;
  fat_percent: number | null;
  [key: string]: string | number | null | undefined;
}

export interface ExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  is_custom: boolean;
}

export interface ExerciseHistoryPoint {
  date: string;
  workoutId: string;
  workoutTitle: string;
  bestSet: { weightKg: number; reps: number; estimated1Rm: number } | null;
}

export interface PersonalRecord {
  value: number;
  date: string;
}

export interface ExerciseStats {
  exerciseTemplateId: string;
  history: ExerciseHistoryPoint[];
  personalRecords: {
    maxWeightKg: PersonalRecord | null;
    maxEstimated1Rm: PersonalRecord | null;
    maxReps: PersonalRecord | null;
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchSummary(days: number): Promise<StatsSummary> {
  return getJson<StatsSummary>(`/api/stats/summary?days=${days}`);
}

export function fetchVolumeByMuscle(days: number): Promise<MuscleGroupVolume[]> {
  return getJson<MuscleGroupVolume[]>(`/api/stats/volume-by-muscle?days=${days}`);
}

export function fetchMeasurements(): Promise<BodyMeasurement[]> {
  return getJson<BodyMeasurement[]>(`/api/stats/measurements`);
}

export function fetchExerciseTemplates(): Promise<ExerciseTemplate[]> {
  return getJson<ExerciseTemplate[]>(`/api/exercise-templates`);
}

export function fetchExerciseStats(exerciseTemplateId: string): Promise<ExerciseStats> {
  return getJson<ExerciseStats>(
    `/api/stats/exercise/${encodeURIComponent(exerciseTemplateId)}`,
  );
}
