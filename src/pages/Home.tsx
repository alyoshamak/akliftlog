import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { computeNextDayNumber } from "@/lib/nextUp";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronRight, Dumbbell, Flame, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

type Day = { id: string; day_number: number; name: string | null; exercise_count: number };

export default function Home() {
  const { user } = useAuth();
  const { profile, loading: profLoading } = useProfile();
  const nav = useNavigate();
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [nextDayNum, setNextDayNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentCount, setRecentCount] = useState(0);

  // Onboarding redirect
  useEffect(() => {
    if (!profLoading && profile && !profile.onboarded) {
      nav("/onboarding", { replace: true });
    }
  }, [profile, profLoading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: plan } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (plan) {
        setPlanId(plan.id);
        setPlanName(plan.name);
        const { data: ds } = await supabase
          .from("plan_days")
          .select("id, day_number, name, plan_day_exercises(count)")
          .eq("plan_id", plan.id)
          .order("day_number");
        const list: Day[] = ((ds as any[]) ?? []).map((d) => ({
          id: d.id, day_number: d.day_number, name: d.name, exercise_count: d.plan_day_exercises?.[0]?.count ?? 0,
        }));
        setDays(list);
        if (list.length > 0) {
          const n = await computeNextDayNumber(user.id, plan.id, list.length);
          setNextDayNum(n);
        }
      }

      const { count } = await supabase
        .from("workout_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("finished_at", "is", null);
      setRecentCount(count ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const startDay = async (day: Day) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workout_sessions")
      .insert({ user_id: user.id, plan_day_id: day.id, day_number: day.day_number })
      .select()
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Could not start session");

    // Pre-create session_exercises from the plan
    const { data: planExs } = await supabase
      .from("plan_day_exercises")
      .select("*")
      .eq("day_id", day.id)
      .order("position");

    if (planExs && planExs.length > 0) {
      await supabase.from("session_exercises").insert(
        planExs.map((p: any) => ({
          session_id: data.id,
          exercise_id: p.exercise_id,
          position: p.position,
          target_sets: p.target_sets,
          target_reps: p.target_reps,
        }))
      );
    }
    nav(`/session/${data.id}`);
  };

  const startFreeWorkout = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workout_sessions")
      .insert({ user_id: user.id })
      .select()
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Could not start session");
    nav(`/session/${data.id}`);
  };

  if (loading || profLoading) {
    return <AppShell><div className="flex h-full items-center justify-center pt-20"><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></div></AppShell>;
  }

  const nextDay = nextDayNum ? days.find((d) => d.day_number === nextDayNum) : null;
  const greeting = greet(profile?.display_name);

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <div className="pt-3 pb-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{greeting}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Ready to lift?</h1>
        </div>

        {nextDay ? (
          <div className="mt-6 rounded-2xl bg-accent text-accent-foreground p-5 accent-glow">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-70">
              <Flame className="h-3.5 w-3.5" /> Next Up
            </div>
            <div className="mt-2 text-2xl font-extrabold">
              Day {nextDay.day_number}{nextDay.name ? ` · ${nextDay.name}` : ""}
            </div>
            <div className="mt-1 text-sm opacity-80">{nextDay.exercise_count} exercises</div>
            <Button
              onClick={() => startDay(nextDay)}
              className="mt-4 w-full tap-56 bg-foreground text-background hover:bg-foreground/90 font-bold text-base"
            >
              Start Workout <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : days.length === 0 ? (
          <div className="mt-6 surface-card p-6 text-center">
            <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold">No plan yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Build a plan or upload one to get started.</p>
            <Button onClick={() => nav("/plan")} className="mt-4 tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
              Set up my plan
            </Button>
          </div>
        ) : (
          <div className="mt-6 surface-card p-5">
            <p className="font-semibold">No days in your plan yet</p>
            <Button onClick={() => nav("/plan")} className="mt-3 tap-44">Edit plan</Button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetTrigger asChild>
              <button className="surface-card p-4 text-left tap-56">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div className="mt-2 font-bold text-sm">Pick a day</div>
                <div className="text-xs text-muted-foreground">Train something else</div>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>Pick a workout day</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 pb-safe">
                {days.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setPickerOpen(false); startDay(d); }}
                    className="w-full surface-card p-4 text-left flex items-center justify-between tap-56"
                  >
                    <div>
                      <div className="font-bold">Day {d.day_number}{d.name ? ` · ${d.name}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{d.exercise_count} exercises</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
                {days.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No days yet.</p>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <button onClick={startFreeWorkout} className="surface-card p-4 text-left tap-56">
            <Plus className="h-5 w-5 text-accent" />
            <div className="mt-2 font-bold text-sm">Free Workout</div>
            <div className="text-xs text-muted-foreground">Build it as you go</div>
          </button>
        </div>

        {recentCount > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => nav("/progress")}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {recentCount} workout{recentCount === 1 ? "" : "s"} logged →
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function greet(name?: string | null) {
  const h = new Date().getHours();
  const t = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  return name ? `${t}, ${name.split(" ")[0]}` : t;
}
