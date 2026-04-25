import { useEffect, useState, useMemo } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/integrations/supabase/client";

export type Exercise = {
  id: string;
  name: string;
  muscle_group: "chest" | "back" | "legs" | "shoulders" | "arms" | "core";
  aliases: string[];
  is_compound: boolean;
  is_custom: boolean;
  owner_id: string | null;
};

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("exercises").select("*").order("name");
    setExercises((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const fuse = useMemo(
    () =>
      new Fuse(exercises, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "aliases", weight: 0.3 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [exercises]
  );

  const search = (q: string) => {
    if (!q.trim()) return exercises;
    return fuse.search(q).map((r) => r.item);
  };

  return { exercises, loading, search, refresh };
}
