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

  // Pull all session_exercises (with sets) for these exercises owned by user.
  // NOTE: PostgREST's `order({ foreignTable })` only sorts the embedded resource,
  // not the parent rows — so we must sort client-side by finished_at to truly
  // get the most-recent completed session per exercise.
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
    .not("session.finished_at", "is", null)
    .limit(2000);

  if (error || !data) return {};

  // Group rows by exercise, pick the session containing the heaviest set (PR).
  const byExercise: Record<string, any[]> = {};
  for (const row of data as any[]) {
    if (!row.session?.finished_at) continue;
    if (!row.sets || row.sets.length === 0) continue;
    (byExercise[row.exercise_id] ||= []).push(row);
  }

  const map: Record<string, LastPerformance> = {};
  for (const [exId, rows] of Object.entries(byExercise)) {
    let best: any = null;
    let bestWeight = -Infinity;
    let bestDate = 0;
    for (const row of rows) {
      const maxW = Math.max(...row.sets.map((s: any) => Number(s.weight) || 0));
      const dt = new Date(row.session.finished_at).getTime();
      // Prefer heavier PR; tie-break by most recent so PR reflects latest occurrence.
      if (maxW > bestWeight || (maxW === bestWeight && dt > bestDate)) {
        best = row;
        bestWeight = maxW;
        bestDate = dt;
      }
    }
    if (!best) continue;
    const sets = [...best.sets].sort((a, b) => a.set_number - b.set_number).map((s: any) => ({
      weight: Number(s.weight),
      reps: s.reps,
      unit: s.unit,
    }));
    map[exId] = {
      exercise_id: exId,
      session_id: best.session.id,
      performed_at: best.session.finished_at,
      sets,
    };
  }
  return map;
}

/**
 * Suggest weight/reps for an exercise's set based on the user's PR session.
 * No progressive-overload nudge — always prefill with the PR set values so the
 * user consciously decides whether to push heavier.
 */
export function suggestSet(
  last: LastPerformance | undefined,
  targetReps: number,
  setIndex: number,
  _opts: { isCompound: boolean; goal: "hypertrophy" | "strength" | "endurance" }
): { weight: number; reps: number } {
  if (!last || last.sets.length === 0) {
    return { weight: 0, reps: targetReps };
  }
  const prSet = last.sets[setIndex] ?? last.sets[last.sets.length - 1];
  return { weight: prSet.weight, reps: prSet.reps || targetReps };
}

