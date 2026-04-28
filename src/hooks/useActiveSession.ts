import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActiveSession = {
  id: string;
  started_at: string;
  plan_day_id: string | null;
  day_number: number | null;
  day_name: string | null;
};

export function useActiveSession() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSession(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, started_at, plan_day_id, day_number, plan_days(name)")
      .eq("user_id", user.id)
      .is("finished_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      setSession(null);
    } else {
      setSession({
        id: data.id,
        started_at: data.started_at,
        plan_day_id: data.plan_day_id,
        day_number: data.day_number,
        day_name: (data as any).plan_days?.name ?? null,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  const discard = useCallback(async () => {
    if (!session) return;
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    setSession(null);
  }, [session]);

  return { session, loading, refresh, discard };
}
