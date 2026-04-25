import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Profile = {
  id: string;
  display_name: string | null;
  goal: "hypertrophy" | "strength" | "endurance";
  unit_pref: "lb" | "kg";
  theme: "dark" | "light" | "system";
  onboarded: boolean;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setProfile(data as any);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [user]);

  const update = async (patch: Partial<Profile>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (!error && data) setProfile(data as any);
    return { data, error };
  };

  return { profile, loading, update };
}
