import AppShell from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/hooks/useExercises";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLastPerformanceMap, type LastPerformance } from "@/lib/lastPerformance";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function History() {
  const { user } = useAuth();
  const { exercises, search } = useExercises();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [perfMap, setPerfMap] = useState<Record<string, LastPerformance>>({});
  const [loadingPerf, setLoadingPerf] = useState(true);

  useEffect(() => {
    if (!user || exercises.length === 0) return;
    (async () => {
      setLoadingPerf(true);
      const map = await fetchLastPerformanceMap(user.id, exercises.map((e) => e.id));
      setPerfMap(map);
      setLoadingPerf(false);
    })();
  }, [user, exercises]);

  const performedExercises = useMemo(
    () => exercises.filter((e) => perfMap[e.id]),
    [exercises, perfMap]
  );

  const list = useMemo(() => {
    const base = q.trim() ? search(q).filter((e) => perfMap[e.id]) : performedExercises;
    // sort by most recent
    return [...base].sort((a, b) => {
      const ta = new Date(perfMap[a.id]?.performed_at ?? 0).getTime();
      const tb = new Date(perfMap[b.id]?.performed_at ?? 0).getTime();
      return tb - ta;
    });
  }, [q, performedExercises, search, perfMap]);

  if (picked && user) return <ExerciseDetail user={user} ex={picked} onBack={() => setPicked(null)} />;

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <h1 className="pt-3 text-3xl font-extrabold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Your completed exercises and last performance.</p>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 tap-56"
          />
        </div>
        <div className="mt-4 space-y-1">
          {!loadingPerf && list.length === 0 && (
            <p className="text-sm text-muted-foreground px-1 py-6 text-center">
              {q.trim() ? "No completed exercises match." : "No completed exercises yet. Finish a workout to see your history."}
            </p>
          )}
          {list.map((ex) => {
            const perf = perfMap[ex.id];
            const topSet = perf?.sets?.[0];
            return (
              <button
                key={ex.id}
                onClick={() => setPicked(ex)}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 tap-56 text-left hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{ex.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{ex.muscle_group}</div>
                </div>
                {topSet && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold num">
                      {topSet.weight}{topSet.unit} × {topSet.reps}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(perf.performed_at))} ago
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function ExerciseDetail({ user, ex, onBack }: { user: { id: string }; ex: Exercise; onBack: () => void }) {
  const [last, setLast] = useState<LastPerformance | undefined>();
  const [history, setHistory] = useState<{ date: string; topWeight: number }[]>([]);

  useEffect(() => {
    (async () => {
      const map = await fetchLastPerformanceMap(user.id, [ex.id]);
      setLast(map[ex.id]);
      // pull last ~10 sessions for trend
      const { data } = await supabase
        .from("session_exercises")
        .select(`exercise_id, session:workout_sessions!inner(id, user_id, finished_at), sets:session_sets(weight)`)
        .eq("exercise_id", ex.id)
        .eq("session.user_id", user.id)
        .order("finished_at", { foreignTable: "session", ascending: false })
        .limit(20);
      const rows = ((data as any[]) ?? [])
        .filter((r) => r.session?.finished_at && r.sets?.length)
        .map((r) => ({
          date: format(new Date(r.session.finished_at), "MMM d"),
          topWeight: Math.max(...r.sets.map((s: any) => Number(s.weight))),
        }))
        .reverse();
      setHistory(rows);
    })();
  }, [ex, user]);

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2 pt-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{ex.name}</h1>
        <p className="text-sm text-muted-foreground capitalize">{ex.muscle_group}</p>

        <div className="mt-5 surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Last performance</div>
          {last ? (
            <>
              <div className="mt-2 text-3xl font-extrabold num">
                {last.sets[0].weight} <span className="text-base text-muted-foreground">{last.sets[0].unit}</span>
              </div>
              <div className="mt-1 text-sm">{last.sets.map((s) => `${s.weight}×${s.reps}`).join(" · ")}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(last.performed_at))} ago</div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No history yet.</p>
          )}
        </div>

        {history.length >= 2 && (
          <div className="mt-4 surface-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top set over time</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={28} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="topWeight" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
