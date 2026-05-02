import AppShell from "@/components/AppShell";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload as UploadIcon, FileText, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useExercises } from "@/hooks/useExercises";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";

type Confidence = "high" | "medium" | "low";
type DraftExercise = {
  name: string;
  sets: number;
  reps: number;
  matched_id?: string;
  confidence?: Confidence;
  defaultsApplied?: boolean;
};
type DraftDay = { name: string; exercises: DraftExercise[] };

type Goal = "hypertrophy" | "strength" | "endurance";

function defaultsForGoal(goal: Goal | undefined): { sets: number; reps: number } {
  if (goal === "strength") return { sets: 5, reps: 5 };
  if (goal === "endurance") return { sets: 3, reps: 15 };
  return { sets: 3, reps: 10 };
}

export default function Upload() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromHub = params.get("from") === "hub";
  const { exercises, search, refresh } = useExercises();
  const { profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftDay[] | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const onFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("plan-uploads").upload(path, file);
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("parse-plan-document", {
        body: { path, mime: file.type, name: file.name, goal: profile?.goal },
      });
      if (error) throw error;

      const rawDays: any[] = data?.days ?? [];
      if (rawDays.length === 0) {
        const reason = data?.reason;
        const msg =
          reason === "pdf_render_failed" ? "Couldn't read that PDF. Try a clearer scan or screenshot."
          : reason === "empty_spreadsheet" ? "That spreadsheet looks empty."
          : reason === "empty_file" ? "That file is empty."
          : reason === "unsupported_format" ? "Unsupported file format. Try an image, PDF, CSV, or XLSX."
          : "We couldn't find a workout plan in this file. Try a clearer image or paste the text.";
        toast.error(msg);
        return;
      }

      const def = defaultsForGoal(profile?.goal);
      const days: DraftDay[] = rawDays.map((d: any) => ({
        name: d.name ?? "Day",
        exercises: (d.exercises ?? []).map((e: any) => {
          const missingSets = e.sets == null;
          const missingReps = e.reps == null;
          const ex: DraftExercise = {
            name: e.name,
            sets: missingSets ? def.sets : Number(e.sets),
            reps: missingReps ? def.reps : Number(e.reps),
            confidence: e.confidence,
            defaultsApplied: missingSets || missingReps,
          };
          const hits = search(ex.name);
          if (hits[0]) ex.matched_id = hits[0].id;
          return ex;
        }),
      }));

      setDraft(days);
      const filledCount = days.flatMap(d => d.exercises).filter(e => e.defaultsApplied).length;
      if (filledCount > 0) {
        toast.success(`Plan parsed. ${filledCount} exercise${filledCount === 1 ? "" : "s"} auto-filled from your goal.`);
      } else {
        toast.success("Plan parsed. Review and save.");
      }
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
      // From onboarding, deactivate any existing plan and make this active.
      // From hub, leave existing active plan alone and ask user later.
      if (!fromHub) {
        await supabase.from("workout_plans").update({ is_active: false }).eq("user_id", user.id);
      }
      const cleanName = fileName.replace(/\.[^/.]+$/, "") || "Uploaded Plan";
      const { data: plan, error } = await supabase
        .from("workout_plans").insert({
          user_id: user.id,
          name: cleanName,
          description: `Imported from ${fileName || "upload"}`,
          source: "upload",
          is_active: !fromHub,
        })
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
              .insert({ name: e.name, muscle_group: "other", is_custom: true, owner_id: user.id })
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
      const askActive = fromHub ? "&askActive=1" : "";
      nav(`/plan/edit?planId=${plan.id}&first=1${askActive}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const allEx = draft?.flatMap(d => d.exercises) ?? [];
  const filledCount = allEx.filter(e => e.defaultsApplied).length;
  const lowConfCount = allEx.filter(e => e.confidence === "low").length;

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
            {(filledCount > 0 || lowConfCount > 0) && (
              <div className="surface-card p-3 text-xs space-y-1.5 border border-accent/30">
                {filledCount > 0 && (
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">{filledCount}</span> exercise{filledCount === 1 ? "" : "s"} had no sets/reps in your file — we filled defaults based on your goal ({profile?.goal ?? "hypertrophy"}). Edit any value below.
                    </span>
                  </div>
                )}
                {lowConfCount > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span><span className="font-semibold">{lowConfCount}</span> low-confidence entr{lowConfCount === 1 ? "y" : "ies"} — please double-check before saving.</span>
                  </div>
                )}
              </div>
            )}

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
                      {(ex.defaultsApplied || ex.confidence === "low") && (
                        <div className="flex items-center gap-1.5 pl-6 flex-wrap">
                          {ex.defaultsApplied && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">
                              <Sparkles className="h-3 w-3" /> auto-filled
                            </span>
                          )}
                          {ex.confidence === "low" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 text-yellow-500 px-2 py-0.5 text-[10px] font-semibold">
                              <AlertTriangle className="h-3 w-3" /> low confidence
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1.5 pl-6">
                        <DraftStepper
                          value={ex.sets}
                          onChange={(v) => {
                            const next = [...draft];
                            next[di].exercises[ei] = { ...ex, sets: v, defaultsApplied: false };
                            setDraft(next);
                          }}
                          min={1} max={10} label="sets"
                        />
                        <span className="text-muted-foreground text-xs">×</span>
                        <DraftStepper
                          value={ex.reps}
                          onChange={(v) => {
                            const next = [...draft];
                            next[di].exercises[ei] = { ...ex, reps: v, defaultsApplied: false };
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
