import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { Flame, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type SessionSummary = {
  id: string;
  finished_at: string;
  started_at: string;
  day_number: number | null;
};

type SessionDetail = {
  id: string;
  finished_at: string;
  started_at: string;
  day_number: number | null;
  exercises: {
    id: string;
    name: string;
    muscle_group: string;
    sets: { set_number: number; weight: number; reps: number; unit: string }[];
  }[];
};

export default function Progress() {
  const { user } = useAuth();
  const [days, setDays] = useState<{ date: Date; count: number; sessions: SessionSummary[] }[]>([]);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const [openDate, setOpenDate] = useState<Date | null>(null);
  const [details, setDetails] = useState<SessionDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = subDays(startOfDay(new Date()), 84).toISOString();
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, finished_at, started_at, day_number")
        .eq("user_id", user.id)
        .not("finished_at", "is", null)
        .gte("finished_at", since)
        .order("finished_at", { ascending: false });
      const list = (data as SessionSummary[]) ?? [];
      setTotal(list.length);
      setRecent(list.slice(0, 8));

      const byDay = new Map<string, SessionSummary[]>();
      for (const s of list) {
        const k = format(new Date(s.finished_at), "yyyy-MM-dd");
        const arr = byDay.get(k) ?? [];
        arr.push(s);
        byDay.set(k, arr);
      }

      const grid: { date: Date; count: number; sessions: SessionSummary[] }[] = [];
      for (let i = 83; i >= 0; i--) {
        const d = subDays(startOfDay(new Date()), i);
        const key = format(d, "yyyy-MM-dd");
        const sessions = byDay.get(key) ?? [];
        grid.push({ date: d, count: sessions.length, sessions });
      }
      setDays(grid);

      let s = 0;
      for (let i = 0; i < grid.length; i++) {
        const day = grid[grid.length - 1 - i];
        if (day.count > 0) s++;
        else break;
      }
      setStreak(s);
    })();
  }, [user]);

  const openSessionsForDate = async (date: Date, sessions: SessionSummary[]) => {
    if (sessions.length === 0) return;
    setOpenDate(date);
    setLoadingDetails(true);
    setDetails([]);

    const sessionIds = sessions.map((s) => s.id);
    const { data: exs } = await supabase
      .from("session_exercises")
      .select("id, session_id, position, exercise:exercises(name, muscle_group), sets:session_sets(set_number, weight, reps, unit)")
      .in("session_id", sessionIds)
      .order("position");

    const exList = (exs as any[]) ?? [];
    const built: SessionDetail[] = sessions.map((s) => ({
      ...s,
      exercises: exList
        .filter((e) => e.session_id === s.id)
        .map((e) => ({
          id: e.id,
          name: e.exercise?.name ?? "Unknown",
          muscle_group: e.exercise?.muscle_group ?? "",
          sets: (e.sets ?? [])
            .slice()
            .sort((a: any, b: any) => a.set_number - b.set_number),
        }))
        .filter((e) => e.sets.length > 0),
    }));
    setDetails(built);
    setLoadingDetails(false);
  };

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
            {days.map((d, i) => {
              const hasWorkout = d.count > 0;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!hasWorkout}
                  onClick={() => openSessionsForDate(d.date, d.sessions)}
                  title={`${format(d.date, "MMM d")}: ${d.count}`}
                  className={`aspect-square rounded-sm transition-transform ${hasWorkout ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-accent/60" : "cursor-default"}`}
                  style={{
                    background: hasWorkout
                      ? `hsl(var(--accent) / ${Math.min(0.4 + d.count * 0.3, 1)})`
                      : "hsl(var(--surface-3))",
                  }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Tap any highlighted day to see what you did.</p>
        </div>

        {recent.length > 0 && (
          <div className="mt-5 surface-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent workouts</div>
            <div className="divide-y divide-border">
              {recent.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSessionsForDate(startOfDay(new Date(s.finished_at)), [s])}
                  className="w-full flex items-center justify-between py-3 text-left tap-44"
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {format(new Date(s.finished_at), "EEE, MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(s.finished_at), "h:mm a")}
                      {s.day_number ? ` · Day ${s.day_number}` : " · Free workout"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Per-exercise charts available from the History tab.
        </p>
      </div>

      <Dialog open={!!openDate} onOpenChange={(o) => { if (!o) { setOpenDate(null); setDetails([]); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openDate ? format(openDate, "EEEE, MMM d, yyyy") : ""}
            </DialogTitle>
            <DialogDescription>
              {details.length > 0
                ? `${details.length} workout${details.length === 1 ? "" : "s"} on this day`
                : loadingDetails ? "Loading…" : "No details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {details.map((sess, sIdx) => (
              <div key={sess.id} className="space-y-3">
                {details.length > 1 && (
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Workout {sIdx + 1} · {format(new Date(sess.finished_at), "h:mm a")}
                  </div>
                )}
                {details.length === 1 && (
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(sess.finished_at), "h:mm a")}
                    {sess.day_number ? ` · Day ${sess.day_number}` : " · Free workout"}
                  </div>
                )}
                {sess.exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sets logged.</p>
                ) : (
                  sess.exercises.map((ex) => (
                    <div key={ex.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-bold text-sm">{ex.name}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ex.muscle_group}</div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {ex.sets.map((set) => (
                          <div key={set.set_number} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground w-12">Set {set.set_number}</span>
                            <span className="num font-semibold">
                              {set.weight} <span className="text-xs text-muted-foreground">{set.unit}</span>
                              <span className="mx-1.5 text-muted-foreground">×</span>
                              {set.reps}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
