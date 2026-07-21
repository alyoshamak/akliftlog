import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";

type Props = {
  show: boolean;
  exerciseName: string;
  weight: number;
  reps: number;
  unit: string;
  onDone: () => void;
};

export function PrCelebration({ show, exerciseName, weight, reps, unit, onDone }: Props) {
  useEffect(() => {
    if (!show) return;

    // Multi-burst confetti from both sides + center pop
    const fire = (opts: confetti.Options) =>
      confetti({
        zIndex: 9999,
        disableForReducedMotion: true,
        colors: ["#d4ff00", "#00e5ff", "#ff3ea5", "#fff566", "#ffffff"],
        ...opts,
      });

    fire({ particleCount: 90, spread: 70, startVelocity: 55, origin: { x: 0.5, y: 0.6 } });
    setTimeout(() => fire({ particleCount: 60, angle: 60, spread: 80, origin: { x: 0, y: 0.7 } }), 120);
    setTimeout(() => fire({ particleCount: 60, angle: 120, spread: 80, origin: { x: 1, y: 0.7 } }), 220);
    setTimeout(() => fire({ particleCount: 40, spread: 120, scalar: 1.3, origin: { x: 0.5, y: 0.5 } }), 380);

    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center px-6"
      aria-live="polite"
      role="status"
    >
      <div className="pop-in flex flex-col items-center gap-2 rounded-2xl border border-accent bg-background/90 backdrop-blur-md px-6 py-5 shadow-[var(--shadow-glow)] max-w-[90vw]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground check-burst">
          <Trophy className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">New PR!</div>
        <div className="text-base font-extrabold text-center leading-tight">{exerciseName}</div>
        <div className="num text-2xl font-black">
          {weight}
          <span className="text-sm font-bold text-muted-foreground ml-1">{unit}</span>
          <span className="mx-2 text-muted-foreground">×</span>
          {reps}
        </div>
      </div>
    </div>
  );
}
