import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { Flame } from "lucide-react";

export default function Progress() {
  const { user } = useAuth();
  const [days, setDays] = useState<{ date: Date; count: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = subDays(startOfDay(new Date()), 84).toISOString();
      const { data } = await supabase
        .from("workout_sessions")
        .select("finished_at")
        .eq("user_id", user.id)
        .not("finished_at", "is", null)
        .gte("finished_at", since)
        .order("finished_at", { ascending: false });
      const list = (data as any[]) ?? [];
      setTotal(list.length);

      const grid: { date: Date; count: number }[] = [];
      const map = new Map<string, number>();
      for (const s of list) {
        const k = format(new Date(s.finished_at), "yyyy-MM-dd");
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      for (let i = 83; i >= 0; i--) {
        const d = subDays(startOfDay(new Date()), i);
        grid.push({ date: d, count: map.get(format(d, "yyyy-MM-dd")) ?? 0 });
      }
      setDays(grid);

      // streak: days back from today with any workout
      let s = 0;
      for (let i = 0; i < grid.length; i++) {
        const day = grid[grid.length - 1 - i];
        if (day.count > 0) s++;
        else break;
      }
      setStreak(s);
    })();
  }, [user]);

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <h1 className="pt-3 text-3xl font-extrabold tracking-tight">Progress</h1>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="surface-card p-4">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Flame className="h-3.5 w-3.5 text-accent" /> Streak</div>
            <div className="mt-2 text-3xl font-extrabold num">{streak}<span className="text-sm text-muted-foreground ml-1">{streak === 1 ? "day" : "days"}</span></div>
          </div>
          <div className="surface-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Last 12 weeks</div>
            <div className="mt-2 text-3xl font-extrabold num">{total}<span className="text-sm text-muted-foreground ml-1">workouts</span></div>
          </div>
        </div>

        <div className="mt-5 surface-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Consistency</div>
          <div className="grid grid-cols-12 gap-1">
            {days.map((d, i) => (
              <div
                key={i}
                title={`${format(d.date, "MMM d")}: ${d.count}`}
                className="aspect-square rounded-sm"
                style={{
                  background: d.count > 0
                    ? `hsl(var(--accent) / ${Math.min(0.4 + d.count * 0.3, 1)})`
                    : "hsl(var(--surface-3))",
                }}
              />
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Per-exercise charts available from the History tab.
        </p>
      </div>
    </AppShell>
  );
}
