import { supabase } from "@/integrations/supabase/client";

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomSlug(len = 10) {
  let s = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function profileShareUrl(slug: string) {
  return `${window.location.origin}/u/${slug}`;
}

export function planShareUrl(slug: string) {
  return `${window.location.origin}/p/${slug}`;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type PlanSnapshot = {
  days: {
    day_number: number;
    name: string | null;
    exercises: {
      exercise_id: string;
      name: string;
      muscle_group: string;
      target_sets: number;
      target_reps: number;
      superset_group: number | null;
      position: number;
    }[];
  }[];
};

export async function buildPlanSnapshot(planId: string): Promise<PlanSnapshot> {
  const { data: days } = await supabase
    .from("plan_days")
    .select("id, day_number, name")
    .eq("plan_id", planId)
    .order("day_number");
  const dayList = (days as any[]) ?? [];
  const dayIds = dayList.map((d) => d.id);
  const { data: exs } = dayIds.length
    ? await supabase
        .from("plan_day_exercises")
        .select("day_id, position, target_sets, target_reps, superset_group, exercise:exercises(id, name, muscle_group)")
        .in("day_id", dayIds)
        .order("position")
    : { data: [] as any[] };
  const exList = (exs as any[]) ?? [];
  return {
    days: dayList.map((d) => ({
      day_number: d.day_number,
      name: d.name,
      exercises: exList
        .filter((e) => e.day_id === d.id)
        .map((e) => ({
          exercise_id: e.exercise?.id,
          name: e.exercise?.name ?? "Unknown",
          muscle_group: e.exercise?.muscle_group ?? "",
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          superset_group: e.superset_group,
          position: e.position,
        })),
    })),
  };
}

export async function createOrReplacePlanShare(
  userId: string,
  planId: string,
  planName: string,
  planDescription: string | null,
  sharedByName: string,
): Promise<{ slug: string }> {
  const snapshot = await buildPlanSnapshot(planId);
  // Revoke any prior live shares for this plan
  await supabase
    .from("plan_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("source_plan_id", planId)
    .is("revoked_at", null);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug(10);
    const { data, error } = await supabase
      .from("plan_shares")
      .insert({
        slug,
        user_id: userId,
        source_plan_id: planId,
        plan_name: planName,
        plan_description: planDescription,
        shared_by_name: sharedByName,
        snapshot: snapshot as any,
      })
      .select("slug")
      .maybeSingle();
    if (!error && data) return { slug: (data as any).slug };
    if (error && !/duplicate key|unique/i.test(error.message)) throw error;
  }
  throw new Error("Could not generate share link");
}

export async function getOrCreateProfileShare(userId: string): Promise<{ slug: string }> {
  const { data: existing } = await supabase
    .from("profile_shares")
    .select("slug, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing && !(existing as any).revoked_at) return { slug: (existing as any).slug };

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug(10);
    if (existing) {
      const { error } = await supabase
        .from("profile_shares")
        .update({ slug, revoked_at: null })
        .eq("user_id", userId);
      if (!error) return { slug };
      if (!/duplicate key|unique/i.test(error.message)) throw error;
    } else {
      const { error } = await supabase
        .from("profile_shares")
        .insert({ user_id: userId, slug });
      if (!error) return { slug };
      if (!/duplicate key|unique/i.test(error.message)) throw error;
    }
  }
  throw new Error("Could not generate profile link");
}

export async function revokeShare(table: "plan_shares" | "profile_shares", id: string) {
  await supabase.from(table).update({ revoked_at: new Date().toISOString() }).eq("id", id);
}

/** Copy a snapshot into the user's plan library. Returns the new plan id. */
export async function copyPlanFromSnapshot(
  userId: string,
  planName: string,
  planDescription: string | null,
  snapshot: PlanSnapshot,
): Promise<string> {
  // Insert plan
  const { data: newPlan, error: planErr } = await supabase
    .from("workout_plans")
    .insert({
      user_id: userId,
      name: planName,
      description: planDescription,
      source: "custom",
      is_active: false,
    })
    .select("id")
    .maybeSingle();
  if (planErr || !newPlan) throw planErr ?? new Error("Could not create plan");
  const newPlanId = (newPlan as any).id as string;

  // Build exercise lookup. Match by id (visible to user) first, then by name.
  const allExerciseNames = Array.from(
    new Set(snapshot.days.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase()))),
  );
  const allExerciseIds = Array.from(
    new Set(snapshot.days.flatMap((d) => d.exercises.map((e) => e.exercise_id).filter(Boolean))),
  );

  const idMap = new Map<string, string>(); // snapshot.exercise_id -> resolved exercise_id
  const nameMap = new Map<string, string>(); // lower(name) -> resolved exercise_id

  if (allExerciseIds.length) {
    const { data: byId } = await supabase
      .from("exercises")
      .select("id, name, owner_id")
      .in("id", allExerciseIds as string[]);
    for (const e of (byId as any[]) ?? []) {
      if (e.owner_id === null || e.owner_id === userId) idMap.set(e.id, e.id);
    }
  }
  if (allExerciseNames.length) {
    // Pull all (including built-ins + user's customs) and pick best per name
    const { data: byName } = await supabase
      .from("exercises")
      .select("id, name, owner_id")
      .or(`owner_id.is.null,owner_id.eq.${userId}`);
    for (const e of (byName as any[]) ?? []) {
      const k = (e.name as string).toLowerCase();
      // Prefer user's own version over global if both exist
      if (!nameMap.has(k) || e.owner_id === userId) nameMap.set(k, e.id);
    }
  }

  for (const d of snapshot.days) {
    const { data: nd, error: dayErr } = await supabase
      .from("plan_days")
      .insert({ plan_id: newPlanId, day_number: d.day_number, name: d.name })
      .select("id")
      .maybeSingle();
    if (dayErr || !nd) throw dayErr ?? new Error("Could not create day");
    const newDayId = (nd as any).id as string;

    const rows: any[] = [];
    for (const e of d.exercises) {
      let resolved = idMap.get(e.exercise_id) ?? nameMap.get(e.name.toLowerCase());
      if (!resolved) {
        // Create as a custom exercise for this user
        const { data: created } = await supabase
          .from("exercises")
          .insert({
            name: e.name,
            muscle_group: e.muscle_group || "other",
            owner_id: userId,
            is_custom: true,
          })
          .select("id")
          .maybeSingle();
        if (created) {
          resolved = (created as any).id as string;
          nameMap.set(e.name.toLowerCase(), resolved);
        }
      }
      if (!resolved) continue;
      rows.push({
        day_id: newDayId,
        exercise_id: resolved,
        position: e.position,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        superset_group: e.superset_group,
      });
    }
    if (rows.length) await supabase.from("plan_day_exercises").insert(rows);
  }

  return newPlanId;
}

export async function setPlanActive(userId: string, planId: string) {
  await supabase.from("workout_plans").update({ is_active: false }).eq("user_id", userId);
  await supabase.from("workout_plans").update({ is_active: true }).eq("id", planId);
}
