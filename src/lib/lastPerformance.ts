import { supabase } from "@/integrations/supabase/client";

export type LastPerformance = {
  exercise_id: string;
  session_id: string;
  performed_at: string;
  sets: { weight: number; reps: number; unit: string }[];
};

/**
 * Fetch the most-recent performance per exercise for a given user, restricted to a list of exercise IDs.
 * Returns a map keyed by exercise_id.
 */
export async function fetchLastPerformanceMap(
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};

  // Pull all session_exercises (with sets) for these exercises owned by user, ordered by recency
  const { data, error } = await supabase
    .from("session_exercises")
    .select(`
      id,
      exercise_id,
      session:workout_sessions!inner ( id, user_id, started_at, finished_at ),
      sets:session_sets ( set_number, weight, reps, unit, completed_at )
    `)
    .in("exercise_id", exerciseIds)
    .eq("session.user_id", userId)
    .order("started_at", { foreignTable: "session", ascending: false })
    .limit(200);

  if (error || !data) return {};

  const map: Record<string, LastPerformance> = {};
  for (const row of data as any[]) {
    if (!row.session?.finished_at) continue; // only completed sessions
    if (map[row.exercise_id]) continue;
    if (!row.sets || row.sets.length === 0) continue;
    const sets = [...row.sets].sort((a, b) => a.set_number - b.set_number).map((s: any) => ({
      weight: Number(s.weight),
      reps: s.reps,
      unit: s.unit,
    }));
    map[row.exercise_id] = {
      exercise_id: row.exercise_id,
      session_id: row.session.id,
      performed_at: row.session.finished_at,
      sets,
    };
  }
  return map;
}

/**
 * Suggest weight/reps for an exercise's set based on last performance.
 * Rule: match last; if every set hit target reps, nudge.
 */
export function suggestSet(
  last: LastPerformance | undefined,
  targetReps: number,
  setIndex: number,
  opts: { isCompound: boolean; goal: "hypertrophy" | "strength" | "endurance" }
): { weight: number; reps: number } {
  if (!last || last.sets.length === 0) {
    return { weight: 0, reps: targetReps };
  }
  const lastSet = last.sets[setIndex] ?? last.sets[last.sets.length - 1];
  const allHit = last.sets.every((s) => s.reps >= targetReps);
  if (!allHit) return { weight: lastSet.weight, reps: targetReps };

  // Nudge: weight bump for strength/hypertrophy, rep bump for endurance
  if (opts.goal === "endurance") {
    return { weight: lastSet.weight, reps: targetReps + 1 };
  }
  const inc = opts.isCompound ? 5 : 2.5;
  return { weight: lastSet.weight + inc, reps: targetReps };
}
