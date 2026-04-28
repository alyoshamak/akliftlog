import AppShell from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/hooks/useExercises";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLastPerformanceMap, type LastPerformance } from "@/lib/lastPerformance";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, Trophy } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

type PRSet = {
  weight: number;
  reps: number;
  unit: string;
  performed_at: string;
  session_id: string;
};

type SessionEntry = {
  session_id: string;
  performed_at: string;
  sets: { weight: number; reps: number; unit: string; set_number: number }[];
};

/**
 * PR = heaviest weight ever lifted on this exercise.
 * Ties broken by most reps at that weight, then earliest date (first time achieved).
 */
function pickPR(sessions: SessionEntry[]): PRSet | null {
  let best: PRSet | null = null;
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.weight <= 0) continue;
      if (
        !best ||
        set.weight > best.weight ||
        (set.weight === best.weight && set.reps > best.reps) ||
        (set.weight === best.weight &&
          set.reps === best.reps &&
          new Date(s.performed_at) < new Date(best.performed_at))
      ) {
        best = {
          weight: set.weight,
          reps: set.reps,
          unit: set.unit,
          performed_at: s.performed_at,
          session_id: s.session_id,
        };
      }
    }
  }
  return best;
}

async function fetchSessionHistory(
  userId: string,
  exerciseId: string,
  limit = 100
): Promise<SessionEntry[]> {
  const { data } = await supabase
    .from("session_exercises")
    .select(
      `id, exercise_id,
       session:workout_sessions!inner(id, user_id, finished_at),
       sets:session_sets(set_number, weight, reps, unit)`
    )
    .eq("exercise_id", exerciseId)
    .eq("session.user_id", userId)
    .order("finished_at", { foreignTable: "session", ascending: false })
    .limit(limit);
  const out: SessionEntry[] = [];
  for (const r of (data as any[]) ?? []) {
    if (!r.session?.finished_at || !r.sets?.length) continue;
    out.push({
      session_id: r.session.id,
      performed_at: r.session.finished_at,
      sets: [...r.sets]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s: any) => ({
          set_number: s.set_number,
          weight: Number(s.weight),
          reps: s.reps,
          unit: s.unit,
        })),
    });
  }
  return out;
}

async function fetchPRMap(
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, PRSet>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("session_exercises")
    .select(
      `exercise_id,
       session:workout_sessions!inner(id, user_id, finished_at),
       sets:session_sets(weight, reps, unit, set_number)`
    )
    .in("exercise_id", exerciseIds)
    .eq("session.user_id", userId)
    .limit(2000);
  const grouped: Record<string, SessionEntry[]> = {};
  for (const r of (data as any[]) ?? []) {
    if (!r.session?.finished_at || !r.sets?.length) continue;
    (grouped[r.exercise_id] ??= []).push({
      session_id: r.session.id,
      performed_at: r.session.finished_at,
      sets: r.sets.map((s: any) => ({
        set_number: s.set_number,
        weight: Number(s.weight),
        reps: s.reps,
        unit: s.unit,
      })),
    });
  }
  const out: Record<string, PRSet> = {};
  for (const [id, sessions] of Object.entries(grouped)) {
    const pr = pickPR(sessions);
    if (pr) out[id] = pr;
  }
  return out;
}

export default function History() {
  const { user } = useAuth();
  const { exercises, search } = useExercises();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [prMap, setPrMap] = useState<Record<string, PRSet>>({});
  const [loadingPr, setLoadingPr] = useState(true);

  useEffect(() => {
    if (!user || exercises.length === 0) return;
    (async () => {
      setLoadingPr(true);
      const map = await fetchPRMap(user.id, exercises.map((e) => e.id));
      setPrMap(map);
      setLoadingPr(false);
    })();
  }, [user, exercises]);

  const performedExercises = useMemo(
    () => exercises.filter((e) => prMap[e.id]),
    [exercises, prMap]
  );

  const list = useMemo(() => {
    const base = q.trim() ? search(q).filter((e) => prMap[e.id]) : performedExercises;
    return [...base].sort((a, b) => {
      const pa = prMap[a.id];
      const pb = prMap[b.id];
      // sort by most recent PR date
      return new Date(pb?.performed_at ?? 0).getTime() - new Date(pa?.performed_at ?? 0).getTime();
    });
  }, [q, performedExercises, search, prMap]);

  if (picked && user) return <ExerciseDetail user={user} ex={picked} onBack={() => setPicked(null)} />;

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <h1 className="pt-3 text-3xl font-extrabold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Your personal records.</p>
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
          {!loadingPr && list.length === 0 && (
            <p className="text-sm text-muted-foreground px-1 py-6 text-center">
              {q.trim() ? "No completed exercises match." : "No completed exercises yet. Finish a workout to see your history."}
            </p>
          )}
          {list.map((ex) => {
            const pr = prMap[ex.id];
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
                {pr && (
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-sm font-semibold num">
                      <Trophy className="h-3 w-3 text-accent" />
                      {pr.weight}{pr.unit} × {pr.reps}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      PR · {formatDistanceToNow(new Date(pr.performed_at))} ago
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
  const [pr, setPr] = useState<PRSet | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [lastMap, allSessions] = await Promise.all([
        fetchLastPerformanceMap(user.id, [ex.id]),
        fetchSessionHistory(user.id, ex.id),
      ]);
      setLast(lastMap[ex.id]);
      setSessions(allSessions);
      setPr(pickPR(allSessions));
      setLoading(false);
    })();
  }, [ex, user]);

  // PR-over-time: running max weight at each session, oldest → newest
  const prTrend = useMemo(() => {
    const oldestFirst = [...sessions].sort(
      (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
    );
    let runningMax = 0;
    return oldestFirst.map((s) => {
      const sessionMax = Math.max(0, ...s.sets.map((set) => set.weight));
      if (sessionMax > runningMax) runningMax = sessionMax;
      return {
        date: format(new Date(s.performed_at), "MMM d"),
        pr: runningMax,
      };
    });
  }, [sessions]);

  const unit = pr?.unit ?? last?.sets[0]?.unit ?? "lb";

  return (
    <AppShell>
      <div className="px-4 pt-safe pb-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2 pt-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{ex.name}</h1>
        <p className="text-sm text-muted-foreground capitalize">{ex.muscle_group}</p>

        {/* PR card */}
        <div className="mt-5 rounded-2xl bg-accent text-accent-foreground p-5 accent-glow">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
            <Trophy className="h-3.5 w-3.5" /> Personal Record
          </div>
          {pr ? (
            <>
              <div className="mt-2 text-4xl font-extrabold num">
                {pr.weight} <span className="text-lg opacity-80">{pr.unit}</span>
                <span className="text-2xl opacity-90"> × {pr.reps}</span>
              </div>
              <div className="mt-1 text-xs opacity-80">
                {format(new Date(pr.performed_at), "MMM d, yyyy")} · {formatDistanceToNow(new Date(pr.performed_at))} ago
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm opacity-80">No PR yet.</div>
          )}
        </div>

        {/* Last performance */}
        <div className="mt-3 surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Last performance</div>
          {last ? (
            <>
              <div className="mt-2 text-sm font-semibold">
                {last.sets.map((s) => `${s.weight}×${s.reps}`).join(" · ")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {format(new Date(last.performed_at), "MMM d, yyyy")} · {formatDistanceToNow(new Date(last.performed_at))} ago
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No history yet.</p>
          )}
        </div>

        {/* PR trend */}
        {prTrend.length >= 2 && (
          <div className="mt-3 surface-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">PR over time ({unit})</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={28} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="stepAfter" dataKey="pr" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Full history */}
        <div className="mt-3 surface-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Full history</div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No history yet.</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const isPrSession = pr && s.session_id === pr.session_id;
                return (
                  <div key={s.session_id} className="rounded-lg bg-secondary/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">
                        {format(new Date(s.performed_at), "MMM d, yyyy")}
                      </div>
                      {isPrSession && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                          <Trophy className="h-3 w-3" /> PR
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-sm">
                      {s.sets.map((set, i) => (
                        <span key={i} className="num">
                          {set.weight}{set.unit}×{set.reps}
                          {i < s.sets.length - 1 ? " · " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
