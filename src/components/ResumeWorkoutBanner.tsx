import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useActiveSession } from "@/hooks/useActiveSession";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HIDDEN_PREFIXES = ["/session/", "/auth", "/onboarding"];

export default function ResumeWorkoutBanner() {
  const { session, discard } = useActiveSession();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!session) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  const label = session.day_number
    ? `Day ${session.day_number}${session.day_name ? ` · ${session.day_name}` : ""}`
    : "Free workout";

  return (
    <>
      <div className="sticky top-0 z-30 bg-accent text-accent-foreground pt-safe shadow-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-3 py-2">
          <button
            onClick={() => nav(`/session/${session.id}`)}
            className="flex flex-1 items-center gap-2 text-left tap-44"
            aria-label="Resume workout"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-foreground/15">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">
                Workout in progress
              </span>
              <span className="block truncate text-xs font-bold">
                {label} · {formatDistanceToNow(new Date(session.started_at))}
              </span>
            </span>
          </button>
          <button
            onClick={() => nav(`/session/${session.id}`)}
            className="rounded-full bg-accent-foreground text-accent px-3 py-1.5 text-xs font-extrabold tap-44 hover:opacity-90"
          >
            Resume
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label="Discard workout"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent-foreground/10 tap-44"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard workout?</AlertDialogTitle>
            <AlertDialogDescription>
              All logged sets in this paused workout will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await discard();
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
