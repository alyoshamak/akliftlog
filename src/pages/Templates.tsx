import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Dumbbell } from "lucide-react";
import { PLAN_TEMPLATES, type PlanTemplate } from "@/lib/planTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Templates() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const fromOnboarding = params.get("from") === "onboarding";
  const [selected, setSelected] = useState<PlanTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const goBack = () => {
    if (selected) return setSelected(null);
    if (fromOnboarding) return nav("/onboarding", { replace: true });
    nav(-1);
  };

  const useTemplate = async (tpl: PlanTemplate) => {
    if (!user) return;
    setBusy(true);
    try {
      // Fetch built-in exercises by name (one query)
      const allNames = Array.from(
        new Set(tpl.days.flatMap((d) => d.exercises.map((e) => e.name)))
      );
      const { data: exRows, error: exErr } = await supabase
        .from("exercises")
        .select("id, name")
        .is("owner_id", null)
        .in("name", allNames);
      if (exErr) throw exErr;
      const idByName = new Map<string, string>(
        (exRows ?? []).map((r: any) => [r.name, r.id])
      );

      // Deactivate any existing active plan
      await supabase
        .from("workout_plans")
        .update({ is_active: false })
        .eq("user_id", user.id);

      const { data: plan, error: planErr } = await supabase
        .from("workout_plans")
        .insert({ user_id: user.id, name: tpl.name, is_active: true })
        .select()
        .maybeSingle();
      if (planErr || !plan) throw planErr ?? new Error("Could not create plan");

      let missing = 0;
      for (let i = 0; i < tpl.days.length; i++) {
        const day = tpl.days[i];
        const { data: pd } = await supabase
          .from("plan_days")
          .insert({ plan_id: plan.id, day_number: i + 1, name: day.name })
          .select()
          .maybeSingle();
        if (!pd) continue;
        const rows = day.exercises
          .map((e, idx) => {
            const exId = idByName.get(e.name);
            if (!exId) {
              missing++;
              return null;
            }
            return {
              day_id: pd.id,
              exercise_id: exId,
              position: idx,
              target_sets: e.sets,
              target_reps: e.reps,
            };
          })
          .filter(Boolean) as any[];
        if (rows.length > 0) {
          await supabase.from("plan_day_exercises").insert(rows);
        }
      }

      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);

      if (missing > 0) {
        toast.warning(`${missing} exercise${missing === 1 ? "" : "s"} not found in library and skipped.`);
      } else {
        toast.success("Template loaded! Customize it below.");
      }
      nav(`/plan?planId=${plan.id}&first=1`, { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not load template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell hideNav>
      <div className="px-4 pt-safe pb-32">
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2 pt-3"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {!selected && (
          <div className="animate-fade-in">
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Choose a template</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a proven split. You can edit anything after.
            </p>

            <div className="mt-6 space-y-3">
              {PLAN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelected(tpl)}
                  className="w-full surface-card p-4 text-left tap-56 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base">{tpl.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-accent font-semibold">
                        <Calendar className="h-3 w-3" />
                        {tpl.daysPerWeek} days/week
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {tpl.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tpl.dayFocus.map((f, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="animate-fade-in">
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{selected.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-accent font-semibold">
              <Calendar className="h-4 w-4" />
              {selected.daysPerWeek} days/week
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>

            <div className="mt-5 space-y-3">
              {selected.days.map((day, di) => (
                <div key={di} className="surface-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent text-xs font-bold">
                      {di + 1}
                    </div>
                    <div className="font-bold">{day.name}</div>
                  </div>
                  <div className="space-y-1.5">
                    {day.exercises.map((e, ei) => (
                      <div
                        key={ei}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Dumbbell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{e.name}</span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground num">
                          {e.sets} × {e.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3 pb-safe">
              <div className="mx-auto flex max-w-md gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelected(null)}
                  disabled={busy}
                  className="flex-1 tap-56 font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => useTemplate(selected)}
                  disabled={busy}
                  className="flex-[2] tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
                >
                  {busy ? "Loading…" : "Use this template"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
