import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dumbbell, Flame, Mountain, Heart, ChevronRight, Smartphone, Share, MoreVertical, PlusSquare } from "lucide-react";
import PlanCreateOptions from "@/components/PlanCreateOptions";

type Goal = "hypertrophy" | "strength" | "endurance";

export default function Onboarding() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [busy, setBusy] = useState(false);

  const saveGoalAndContinue = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ goal }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep(2);
  };

  const platform = useMemo<"ios" | "android" | "desktop">(() => {
    if (typeof navigator === "undefined") return "desktop";
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }, []);

  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);

  const goToInstallStep = (next: () => void) => {
    setPendingNav(() => next);
    setStep(3);
  };

  const goManual = async () => {
    if (!user) return;
    setBusy(true);
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .insert({
        user_id: user.id,
        name: "My Plan",
        description: "Custom plan",
        source: "custom",
        is_active: true,
      })
      .select()
      .maybeSingle();
    if (error || !plan) {
      setBusy(false);
      toast.error(error?.message ?? "Could not create plan");
      return;
    }
    await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    setBusy(false);
    goToInstallStep(() => nav(`/plan/edit?planId=${plan.id}&first=1`, { replace: true }));
  };

  const goUpload = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    goToInstallStep(() => nav("/upload", { replace: true }));
  };

  const goTemplate = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    goToInstallStep(() => nav("/templates?from=onboarding"));
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex items-center gap-3 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-lg">LiftLog</span>
      </div>

      {step === 1 && (
        <div className="mt-10 animate-fade-in">
          <h1 className="text-3xl font-extrabold tracking-tight">What's your goal?</h1>
          <p className="mt-2 text-sm text-muted-foreground">We'll bias suggestions to match.</p>
          <div className="mt-8 space-y-3">
            <GoalCard
              icon={<Flame className="h-6 w-6" />}
              title="Hypertrophy"
              desc="Build muscle. 8–12 reps, weight bumps when you hit targets."
              active={goal === "hypertrophy"}
              onClick={() => setGoal("hypertrophy")}
            />
            <GoalCard
              icon={<Mountain className="h-6 w-6" />}
              title="Strength"
              desc="Lift heavier. 3–6 reps, focus on weight progression."
              active={goal === "strength"}
              onClick={() => setGoal("strength")}
            />
            <GoalCard
              icon={<Heart className="h-6 w-6" />}
              title="Endurance"
              desc="More reps, more volume. Add a rep when you hit the top."
              active={goal === "endurance"}
              onClick={() => setGoal("endurance")}
            />
          </div>
          <Button
            onClick={saveGoalAndContinue}
            disabled={busy}
            className="mt-8 w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
          >
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-10 animate-fade-in">
          <h1 className="text-3xl font-extrabold tracking-tight">Set up your plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick a template, build it yourself, or upload a doc.</p>
          <div className="mt-8">
            <PlanCreateOptions
              disabled={busy}
              onTemplate={goTemplate}
              onManual={goManual}
              onUpload={goUpload}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-10 animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Smartphone className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Add LiftLog to your home screen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One tap to open it next time — no searching, no typing the URL.
          </p>

          {platform !== "android" && (
            <div className="mt-6 surface-card p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-secondary text-[10px] font-extrabold">iOS</span>
                Safari
              </div>
              <ol className="mt-3 space-y-2.5 text-sm">
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">1</span>
                  <span className="flex-1">
                    Tap the <span className="inline-flex h-6 w-6 -mb-1.5 items-center justify-center rounded bg-secondary text-accent"><Share className="h-3.5 w-3.5" /></span> Share button at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">2</span>
                  <span className="flex-1">
                    Scroll and tap <span className="font-semibold">Add to Home Screen</span> <PlusSquare className="h-3.5 w-3.5 inline -mb-0.5" />.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">3</span>
                  <span className="flex-1">Tap <span className="font-semibold">Add</span> in the top-right.</span>
                </li>
              </ol>
            </div>
          )}

          {platform !== "ios" && (
            <div className="mt-3 surface-card p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-secondary text-[10px] font-extrabold">A</span>
                Android · Chrome
              </div>
              <ol className="mt-3 space-y-2.5 text-sm">
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">1</span>
                  <span className="flex-1">
                    Tap the <span className="inline-flex h-6 w-6 -mb-1.5 items-center justify-center rounded bg-secondary text-accent"><MoreVertical className="h-3.5 w-3.5" /></span> menu in the top-right of Chrome.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">2</span>
                  <span className="flex-1">Tap <span className="font-semibold">Add to Home screen</span> (or <span className="font-semibold">Install app</span>).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="num shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold">3</span>
                  <span className="flex-1">Confirm with <span className="font-semibold">Add</span>.</span>
                </li>
              </ol>
            </div>
          )}

          <Button
            onClick={() => { const run = pendingNav; setPendingNav(null); if (run) run(); }}
            className="mt-6 w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
          >
            Got it, continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <button
            onClick={() => { const run = pendingNav; setPendingNav(null); if (run) run(); }}
            className="mt-2 w-full text-xs text-muted-foreground tap-44 hover:underline"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

function GoalCard({
  icon, title, desc, active, onClick,
}: { icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left surface-card p-4 flex items-center gap-4 tap-56 transition-all ${
        active ? "ring-2 ring-accent border-accent" : ""
      }`}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
