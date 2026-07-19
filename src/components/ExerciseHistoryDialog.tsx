import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

type SessionEntry = {
  session_id: string;
  performed_at: string;
  sets: { weight: number; reps: number; unit: string; set_number: number }[];
};

type PRSet = {
  weight: number;
  reps: number;
  unit: string;
  performed_at: string;
  session_id: string;
};

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

export default function ExerciseHistoryDialog({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exerciseId: string | null;
  exerciseName: string;
}) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user || !exerciseId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("session_exercises")
        .select(
          `exercise_id,
           session:workout_sessions!inner(id, user_id, finished_at),
           sets:session_sets(set_number, weight, reps, unit)`
        )
        .eq("exercise_id", exerciseId)
        .eq("session.user_id", user.id)
        .limit(500);
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
      out.sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
      setSessions(out);
      setLoading(false);
    })();
  }, [open, user, exerciseId]);

  const pr = useMemo(() => pickPR(sessions), [sessions]);
  const last = sessions[0];

  const prTrend = useMemo(() => {
    const oldestFirst = [...sessions].sort(
      (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
    );
    let runningMax = 0;
    return oldestFirst.map((s) => {
      const sessionMax = Math.max(0, ...s.sets.map((set) => set.weight));
      if (sessionMax > runningMax) runningMax = sessionMax;
      return { date: format(new Date(s.performed_at), "MMM d"), pr: runningMax };
    });
  }, [sessions]);

  const unit = pr?.unit ?? last?.sets[0]?.unit ?? "lb";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">{exerciseName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No history yet. Finish a set to start building it.
          </div>
        ) : (
          <div className="space-y-3">
            {pr && (
              <div className="rounded-2xl bg-accent text-accent-foreground p-4 accent-glow">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
                  <Trophy className="h-3 w-3" /> Personal Record
                </div>
                <div className="mt-1 text-3xl font-extrabold num">
                  {pr.weight}
                  <span className="text-base opacity-80"> {pr.unit}</span>
                  <span className="text-xl opacity-90"> × {pr.reps}</span>
                </div>
                <div className="text-[11px] opacity-80">
                  {format(new Date(pr.performed_at), "MMM d, yyyy")} ·{" "}
                  {formatDistanceToNow(new Date(pr.performed_at))} ago
                </div>
              </div>
            )}

            {last && (
              <div className="surface-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Last performance
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {last.sets.map((s) => `${s.weight}×${s.reps}`).join(" · ")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(last.performed_at), "MMM d, yyyy")} ·{" "}
                  {formatDistanceToNow(new Date(last.performed_at))} ago
                </div>
              </div>
            )}

            {prTrend.length >= 2 && (
              <div className="surface-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  PR over time ({unit})
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prTrend}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={28} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="pr"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="surface-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Full history
              </div>
              <div className="space-y-2">
                {sessions.map((s) => {
                  const isPr = pr && s.session_id === pr.session_id;
                  return (
                    <div key={s.session_id} className="rounded-lg bg-secondary/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold">
                          {format(new Date(s.performed_at), "MMM d, yyyy")}
                        </div>
                        {isPr && (
                          <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-accent">
                            <Trophy className="h-3 w-3" /> PR
                          </div>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm">
                        {s.sets.map((set, i) => (
                          <span key={i} className="num">
                            {set.weight}
                            {set.unit}×{set.reps}
                            {i < s.sets.length - 1 ? " · " : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
