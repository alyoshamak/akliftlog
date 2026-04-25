import AppShell from "@/components/AppShell";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload as UploadIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useExercises } from "@/hooks/useExercises";
import { Input } from "@/components/ui/input";

type DraftExercise = { name: string; sets: number; reps: number; matched_id?: string };
type DraftDay = { name: string; exercises: DraftExercise[] };

export default function Upload() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { exercises, search, refresh } = useExercises();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftDay[] | null>(null);

  const onFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("plan-uploads").upload(path, file);
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("parse-plan-document", {
        body: { path, mime: file.type, name: file.name },
      });
      if (error) throw error;
      const days: DraftDay[] = data?.days ?? [];
      // Match each exercise to library
      for (const d of days) {
        for (const e of d.exercises) {
          const hits = search(e.name);
          if (hits[0]) e.matched_id = hits[0].id;
        }
      }
      setDraft(days);
      toast.success("Plan parsed. Review and save.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not parse plan");
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async () => {
    if (!user || !draft) return;
    setBusy(true);
    try {
      // Deactivate prior plan
      await supabase.from("workout_plans").update({ is_active: false }).eq("user_id", user.id);
      const { data: plan, error } = await supabase
        .from("workout_plans").insert({ user_id: user.id, name: "My Plan", is_active: true })
        .select().maybeSingle();
      if (error || !plan) throw error;

      for (let i = 0; i < draft.length; i++) {
        const day = draft[i];
        const { data: pd } = await supabase
          .from("plan_days").insert({ plan_id: plan.id, day_number: i + 1, name: day.name || `Day ${i+1}` })
          .select().maybeSingle();
        if (!pd) continue;
        for (let j = 0; j < day.exercises.length; j++) {
          const e = day.exercises[j];
          let exId = e.matched_id;
          if (!exId) {
            const { data: custom } = await supabase
              .from("exercises")
              .insert({ name: e.name, muscle_group: "chest", is_custom: true, owner_id: user.id })
              .select().maybeSingle();
            exId = custom?.id;
          }
          if (exId) {
            await supabase.from("plan_day_exercises").insert({
              day_id: pd.id, exercise_id: exId, position: j, target_sets: e.sets, target_reps: e.reps,
            });
          }
        }
      }
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
      await refresh();
      toast.success("Plan saved!");
      nav("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell hideNav>
      <div className="px-4 pt-safe">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2 pt-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Upload your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">PDF, image, spreadsheet, or text. We'll parse it.</p>

        {!draft && (
          <label className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-12 cursor-pointer hover:border-accent">
            <UploadIcon className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-semibold">{busy ? "Parsing…" : "Tap to choose a file"}</div>
            <input
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.txt,.md,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        )}

        {draft && (
          <div className="mt-5 space-y-4 pb-32">
            {draft.map((day, di) => (
              <div key={di} className="surface-card p-4">
                <Input
                  value={day.name}
                  onChange={(e) => {
                    const next = [...draft]; next[di] = { ...day, name: e.target.value }; setDraft(next);
                  }}
                  className="font-bold mb-2"
                />
                <div className="space-y-2">
                  {day.exercises.map((ex, ei) => (
                    <div key={ei} className="space-y-2 rounded-lg bg-surface-2/40 p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          value={ex.name}
                          onChange={(e) => {
                            const next = [...draft];
                            next[di].exercises[ei] = { ...ex, name: e.target.value };
                            const hits = search(e.target.value);
                            next[di].exercises[ei].matched_id = hits[0]?.id;
                            setDraft(next);
                          }}
                          className={`flex-1 ${ex.matched_id ? "" : "border-destructive"}`}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pl-6">
                        <DraftStepper
                          value={ex.sets}
                          onChange={(v) => {
                            const next = [...draft];
                            next[di].exercises[ei] = { ...ex, sets: v };
                            setDraft(next);
                          }}
                          min={1} max={10} label="sets"
                        />
                        <span className="text-muted-foreground text-xs">×</span>
                        <DraftStepper
                          value={ex.reps}
                          onChange={(v) => {
                            const next = [...draft];
                            next[di].exercises[ei] = { ...ex, reps: v };
                            setDraft(next);
                          }}
                          min={1} max={50} label="reps"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={savePlan} disabled={busy} className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
              {busy ? "Saving…" : "Save plan"}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DraftStepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center rounded-lg bg-secondary">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1.5 text-sm tap-44 font-bold"
        aria-label={`Decrease ${label}`}
      >−</button>
      <div className="w-7 text-center text-sm font-bold num">{value}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 py-1.5 text-sm tap-44 font-bold"
        aria-label={`Increase ${label}`}
      >+</button>
    </div>
  );
}
