import { supabase } from "@/integrations/supabase/client";

/** Compute the next sequential day number for a user's active plan. */
export async function computeNextDayNumber(userId: string, planId: string, totalDays: number) {
  if (totalDays === 0) return 1;
  const { data } = await supabase
    .from("workout_sessions")
    .select("day_number")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .not("day_number", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = data?.day_number ?? 0;
  const next = (last % totalDays) + 1;
  return next;
}
