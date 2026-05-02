import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Pencil, Plus, Copy, Trash2, CheckCircle2, Lock, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  source: "custom" | "template" | "upload" | "influencer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  day_count: number;
};

const sourceLabel: Record<Plan["source"], string> = {
  custom: "Custom",
  template: "Template",
  upload: "Uploaded",
  influencer: "Influencer",
};

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return `${mo}mo ago`;
}

export default function PlansHub() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [libOpen, setLibOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("workout_plans")
      .select("id, name, description, source, is_active, created_at, updated_at, plan_days(count)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    const list: Plan[] = ((data as any[]) ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      source: p.source ?? "custom",
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      day_count: p.plan_days?.[0]?.count ?? 0,
    }));
    setPlans(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const setActive = async (plan: Plan) => {
    if (!user) return;
    await supabase.from("workout_plans").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("workout_plans").update({ is_active: true }).eq("id", plan.id);
    toast.success(`Active plan: ${plan.name}`);
    load();
  };

  const duplicate = async (plan: Plan) => {
    if (!user) return;
    try {
      const { data: newPlan, error } = await supabase
        .from("workout_plans")
        .insert({
          user_id: user.id,
          name: `${plan.name} (Copy)`,
          description: plan.description,
          source: plan.source,
          is_active: false,
        })
        .select().maybeSingle();
      if (error || !newPlan) throw error;

      const { data: days } = await supabase
        .from("plan_days").select("*").eq("plan_id", plan.id).order("day_number");
      for (const d of (days ?? [])) {
        const { data: nd } = await supabase
          .from("plan_days")
          .insert({ plan_id: newPlan.id, day_number: d.day_number, name: d.name })
          .select().maybeSingle();
        if (!nd) continue;
        const { data: exs } = await supabase
          .from("plan_day_exercises").select("*").eq("day_id", d.id).order("position");
        if (exs && exs.length > 0) {
          await supabase.from("plan_day_exercises").insert(
            exs.map((e: any) => ({
              day_id: nd.id,
              exercise_id: e.exercise_id,
              position: e.position,
              target_sets: e.target_sets,
              target_reps: e.target_reps,
              superset_group: e.superset_group,
            }))
          );
        }
      }
      toast.success("Duplicated.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not duplicate");
    }
  };

  const doDelete = async (plan: Plan) => {
    try {
      const { data: days } = await supabase.from("plan_days").select("id").eq("plan_id", plan.id);
      const dayIds = (days ?? []).map((d: any) => d.id);
      if (dayIds.length > 0) {
        await supabase.from("plan_day_exercises").delete().in("day_id", dayIds);
        await supabase.from("plan_days").delete().eq("plan_id", plan.id);
      }
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      toast.success("Plan deleted.");
      if (plan.is_active) toast.message("No active plan — pick one to keep training.");
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not delete");
    }
  };

  const active = plans.find((p) => p.is_active) ?? null;
  const others = plans.filter((p) => !p.is_active);

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <div className="pt-3 pb-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">Manage your workout plans.</p>
        </div>

        <Tabs defaultValue="mine" className="mt-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mine">My Plans</TabsTrigger>
            <TabsTrigger value="influencer">Influencer Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4 space-y-4">
            {loading ? (
              <div className="flex justify-center pt-10">
                <div className="h-8 w-8 animate-pulse rounded-full bg-accent" />
              </div>
            ) : (
              <>
                {active ? (
                  <div className="rounded-2xl border-2 border-accent bg-accent/5 p-5 accent-glow">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active
                    </div>
                    <div className="mt-1.5 text-2xl font-extrabold leading-tight">{active.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{active.day_count} {active.day_count === 1 ? "day" : "days"}</span>
                      <span>·</span>
                      <span>{sourceLabel[active.source]}</span>
                    </div>
                    {active.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{active.description}</p>
                    )}
                    <Button
                      onClick={() => nav(`/plan/edit?planId=${active.id}`)}
                      className="mt-4 w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Edit Plan
                    </Button>
                  </div>
                ) : (
                  <div className="surface-card p-5 text-center">
                    <p className="font-semibold">No active plan</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plans.length > 0 ? "Pick one from your library below." : "Create your first plan to get started."}
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => nav("/plan/new")}
                  className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
                >
                  <Plus className="h-4 w-4 mr-1" /> Create New Plan
                </Button>

                {others.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={() => setLibOpen(!libOpen)}
                      className="flex w-full items-center justify-between py-2 text-left tap-44"
                    >
                      <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        My Plan Library · {others.length}
                      </div>
                      {libOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {libOpen && (
                      <div className="space-y-3">
                        {others.map((p) => (
                          <div key={p.id} className="surface-card p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold leading-tight">{p.name}</div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{p.day_count} {p.day_count === 1 ? "day" : "days"}</span>
                                  <span>·</span>
                                  <span>{sourceLabel[p.source]}</span>
                                  <span>·</span>
                                  <span>Updated {relTime(p.updated_at)}</span>
                                </div>
                                {p.description && (
                                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => setActive(p)}
                                className="tap-44 bg-accent text-accent-foreground hover:bg-accent-glow font-bold text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Set Active
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => nav(`/plan/edit?planId=${p.id}`)}
                                className="tap-44 font-bold text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => duplicate(p)}
                                className="tap-44 font-bold text-xs"
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setConfirmDelete(p)}
                                className="tap-44 font-bold text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="influencer" className="mt-4">
            <div className="relative surface-card p-6 overflow-hidden">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <Lock className="h-7 w-7" />
                </div>
                <div>
                  <div className="font-bold text-lg">Coming soon</div>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Curated plans from coaches and athletes. Save them to your library and customize.
                  </p>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <Sparkles className="h-3 w-3" /> In development
                </div>
              </div>

              {/* Mock locked previews */}
              <div className="mt-6 space-y-2 opacity-40 blur-[2px] pointer-events-none select-none">
                {["IFBB Pro · Hypertrophy", "Strength Coach · Powerlifting", "Athlete · Performance"].map((label) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-surface-2/50 p-3">
                    <div className="h-10 w-10 rounded-full bg-secondary" />
                    <div className="flex-1">
                      <div className="h-3 w-24 rounded bg-secondary mb-1.5" />
                      <div className="h-2.5 w-32 rounded bg-secondary/70" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the plan and all of its days and exercises. Past workouts logged from it stay in your history.
              {confirmDelete?.is_active && " You'll have no active plan after this — pick one to keep training."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && doDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
