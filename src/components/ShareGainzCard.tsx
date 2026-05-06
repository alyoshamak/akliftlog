import { useState } from "react";
import { Sparkles, ChevronRight, TrendingUp, Dumbbell, ArrowLeft } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  copyToClipboardAsync,
  createOrReplacePlanShare,
  getOrCreateProfileShare,
  planShareUrl,
  profileShareUrl,
} from "@/lib/share";

type Plan = { id: string; name: string; description: string | null };
type Step = "menu" | "pickPlan";

export default function ShareGainzCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep("menu"); };

  const getName = async () => {
    if (!user) return "Someone";
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    return (data as any)?.display_name || (data as any)?.username || "Someone";
  };

  const onCopied = () => {
    toast.success("Link copied!", {
      description: "Paste it into a message to share with your friends 💪",
    });
    setOpen(false);
    setTimeout(reset, 250);
  };

  const shareProfile = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await copyToClipboardAsync(async () => {
        const { slug } = await getOrCreateProfileShare(user.id);
        return profileShareUrl(slug);
      });
      onCopied();
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate link");
    } finally {
      setBusy(false);
    }
  };

  const sharePlan = async (plan: Plan) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await copyToClipboardAsync(async () => {
        const { data: existing } = await supabase
          .from("plan_shares")
          .select("slug")
          .eq("user_id", user.id)
          .eq("source_plan_id", plan.id)
          .is("revoked_at", null)
          .maybeSingle();
        let slug = (existing as any)?.slug;
        if (!slug) {
          const sharedBy = await getName();
          const res = await createOrReplacePlanShare(
            user.id, plan.id, plan.name, plan.description, sharedBy,
          );
          slug = res.slug;
        }
        return planShareUrl(slug);
      });
      onCopied();
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate link");
    } finally {
      setBusy(false);
    }
  };

  const goPickPlan = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from("workout_plans")
        .select("id, name, description")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false });
      const list = ((data as any[]) ?? []) as Plan[];
      if (list.length === 0) {
        toast.message("No plans yet", { description: "Create a plan first to share it." });
        return;
      }
      if (list.length === 1) {
        await sharePlan(list[0]);
        return;
      }
      setPlans(list);
      setStep("pickPlan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-4 text-left tap-56 transition-colors hover:border-accent/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">Share your gainz with friends</div>
            <div className="text-xs text-muted-foreground">Send your progress or a workout plan</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTimeout(reset, 250);
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              {step === "pickPlan" && (
                <button
                  onClick={reset}
                  aria-label="Back"
                  className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {step === "menu" ? "Share your gainz" : "Pick a plan to share"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-2 pb-safe">
            {step === "menu" && (
              <>
                <button
                  onClick={shareProfile}
                  disabled={busy}
                  className="w-full surface-card p-4 text-left flex items-center gap-3 tap-56 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">Share your progress</div>
                    <div className="text-xs text-muted-foreground">Your public profile link</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                <button
                  onClick={goPickPlan}
                  disabled={busy}
                  className="w-full surface-card p-4 text-left flex items-center gap-3 tap-56 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">Share workout plans</div>
                    <div className="text-xs text-muted-foreground">Send a plan friends can copy</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </>
            )}

            {step === "pickPlan" && plans.map((p) => (
              <button
                key={p.id}
                onClick={() => sharePlan(p)}
                disabled={busy}
                className="w-full surface-card p-4 text-left flex items-center justify-between gap-3 tap-56 disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.name}</div>
                  {p.description && (
                    <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
