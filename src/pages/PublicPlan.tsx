import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dumbbell, ChevronRight, Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { copyPlanFromSnapshot, setPlanActive, type PlanSnapshot } from "@/lib/share";

type Share = {
  slug: string;
  plan_name: string;
  plan_description: string | null;
  shared_by_name: string;
  snapshot: PlanSnapshot;
  created_at: string;
  revoked: boolean;
};

export default function PublicPlan() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [share, setShare] = useState<Share | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [askActive, setAskActive] = useState<{ planId: string } | null>(null);
  const [copying, setCopying] = useState(false);
  const autoCopy = params.get("copy") === "1";

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_plan_share", { _slug: slug });
      setShare((data as any) ?? null);
      setLoading(false);
      if (data) {
        const s = data as any;
        document.title = `${s.plan_name} — LiftLog`;
      }
    })();
  }, [slug]);

  const doCopy = async () => {
    if (!user || !share || copying) return;
    setCopying(true);
    try {
      const newPlanId = await copyPlanFromSnapshot(
        user.id, share.plan_name, share.plan_description, share.snapshot,
      );
      toast.success("Saved to your plans");
      setAskActive({ planId: newPlanId });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setCopying(false);
    }
  };

  // Auto-run copy after returning from auth
  useEffect(() => {
    if (autoCopy && user && share && !copying && !askActive) {
      doCopy();
      // Strip the param so a refresh doesn't re-copy
      const url = new URL(window.location.href);
      url.searchParams.delete("copy");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCopy, user, share]);

  const onCopyClick = () => {
    if (authLoading) return;
    if (!user) { setAuthPrompt(true); return; }
    doCopy();
  };

  if (loading) {
    return <Centered><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></Centered>;
  }
  if (!share || share.revoked) {
    return (
      <Centered>
        <div className="text-center px-6">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-2xl font-extrabold">Link unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">This plan link is no longer available.</p>
          <Link to="/" className="mt-6 inline-block text-accent underline">Go to LiftLog</Link>
        </div>
      </Centered>
    );
  }

  const dayCount = share.snapshot.days.length;
  const next = encodeURIComponent(`/p/${slug}?copy=1`);

  return (
    <div className="mx-auto min-h-full max-w-md bg-background px-4 pt-safe pb-safe">
      <header className="pt-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Dumbbell className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold tracking-tight">LiftLog</span>
      </header>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Shared workout plan</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight leading-tight">{share.plan_name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {dayCount} {dayCount === 1 ? "day" : "days"} · Shared by {share.shared_by_name}
        </p>
        {share.plan_description && (
          <p className="mt-3 text-sm text-muted-foreground">{share.plan_description}</p>
        )}
      </div>

      <Button
        onClick={onCopyClick}
        disabled={copying}
        className="mt-5 w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
      >
        {copying ? "Saving…" : "Copy to My Plans"} <ChevronRight className="ml-1 h-4 w-4" />
      </Button>

      <div className="mt-7 space-y-5">
        {share.snapshot.days.map((d) => (
          <div key={d.day_number} className="surface-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Day {d.day_number}</div>
            <div className="mt-0.5 text-lg font-extrabold leading-tight">{d.name ?? `Day ${d.day_number}`}</div>
            <div className="mt-3 space-y-1.5">
              {d.exercises.map((e, i) => {
                const prev = d.exercises[i - 1];
                const next = d.exercises[i + 1];
                const linkedPrev = prev && prev.superset_group != null && prev.superset_group === e.superset_group;
                const linkedNext = next && next.superset_group != null && next.superset_group === e.superset_group;
                return (
                  <div key={i}>
                    {e.superset_group != null && !linkedPrev && (
                      <div className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-accent">Superset</div>
                    )}
                    <div
                      className={
                        e.superset_group != null
                          ? `border-x-2 ${linkedPrev ? "" : "rounded-t-lg border-t-2"} ${linkedNext ? "" : "rounded-b-lg border-b-2"} border-accent/60 bg-accent/5 px-2 py-2`
                          : "px-1 py-1"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{e.name}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">{e.muscle_group}</div>
                        </div>
                        <div className="num text-sm font-bold shrink-0">
                          {e.target_sets}<span className="text-muted-foreground mx-1">×</span>{e.target_reps}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {d.exercises.length === 0 && (
                <p className="text-xs text-muted-foreground">No exercises.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onCopyClick}
        disabled={copying}
        className="mt-6 w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
      >
        {copying ? "Saving…" : "Copy to My Plans"} <ChevronRight className="ml-1 h-4 w-4" />
      </Button>

      <footer className="mt-8 text-center text-[11px] text-muted-foreground">
        <Link to="/" className="hover:underline">liftlog</Link>
      </footer>

      {/* Auth prompt for unauthenticated users */}
      <Dialog open={authPrompt} onOpenChange={setAuthPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Join LiftLog to save this plan</DialogTitle>
            <DialogDescription>
              Create a free account (or sign in) to copy this plan to your library and start tracking your workouts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => nav(`/auth?mode=signup&next=${next}`)}
              className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
            >
              Sign up
            </Button>
            <Button
              variant="secondary"
              onClick={() => nav(`/auth?mode=signin&next=${next}`)}
              className="w-full tap-56 font-bold"
            >
              Log in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set as active prompt after copy */}
      <AlertDialog open={!!askActive} onOpenChange={(o) => !o && setAskActive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan saved!</AlertDialogTitle>
            <AlertDialogDescription>
              Want to make this your active plan? You can switch any time from the Plans tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { const id = askActive?.planId; setAskActive(null); if (id) nav(`/plan/edit?planId=${id}`); }}
            >
              Just save
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!user || !askActive) return;
                await setPlanActive(user.id, askActive.planId);
                toast.success("Set as active plan");
                const id = askActive.planId;
                setAskActive(null);
                nav(`/plan/edit?planId=${id}`);
              }}
              className="bg-accent text-accent-foreground hover:bg-accent-glow"
            >
              Set as active
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-md items-center justify-center bg-background">{children}</div>;
}
