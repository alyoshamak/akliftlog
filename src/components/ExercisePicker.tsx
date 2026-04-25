import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useExercises, type Exercise } from "@/hooks/useExercises";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GROUPS: Exercise["muscle_group"][] = ["chest","back","legs","shoulders","arms","core"];
const GROUP_LABEL: Record<string,string> = {
  chest: "Chest", back: "Back", legs: "Legs", shoulders: "Shoulders", arms: "Arms", core: "Core",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (ex: Exercise) => void;
  /** When provided, shows 3 same-muscle-group recommendations at the top. */
  suggestForGroup?: Exercise["muscle_group"];
  /** Exclude these exercise ids from the list (e.g. already-in-session). */
  excludeIds?: string[];
};

export default function ExercisePicker({ open, onOpenChange, onPick, suggestForGroup, excludeIds = [] }: Props) {
  const { exercises, search, refresh } = useExercises();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [activeGroup, setActiveGroup] = useState<Exercise["muscle_group"] | "all">(suggestForGroup ?? "all");
  const [adding, setAdding] = useState(false);

  const results = useMemo(() => {
    let list = q.trim() ? search(q) : exercises;
    if (activeGroup !== "all" && !q.trim()) list = list.filter((e) => e.muscle_group === activeGroup);
    return list.filter((e) => !excludeIds.includes(e.id));
  }, [q, exercises, activeGroup, excludeIds, search]);

  const recommendations = useMemo(() => {
    if (!suggestForGroup || q.trim()) return [];
    return exercises
      .filter((e) => e.muscle_group === suggestForGroup && !excludeIds.includes(e.id))
      .slice(0, 3);
  }, [suggestForGroup, q, exercises, excludeIds]);

  const handleAddCustom = async () => {
    const name = q.trim();
    if (!name || !user) return;
    setAdding(true);
    const group = activeGroup === "all" ? "chest" : activeGroup;
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        name,
        muscle_group: group,
        is_custom: true,
        owner_id: user.id,
      })
      .select()
      .maybeSingle();
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Custom exercise added");
    await refresh();
    onPick(data as any);
    setQ("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 h-[85vh] flex flex-col">
        <DialogHeader className="px-4 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-xl font-bold">Pick an exercise</DialogTitle>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or alias…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 tap-44"
            />
          </div>
          {!q.trim() && (
            <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-1">
              <Chip active={activeGroup === "all"} onClick={() => setActiveGroup("all")}>All</Chip>
              {GROUPS.map((g) => (
                <Chip key={g} active={activeGroup === g} onClick={() => setActiveGroup(g)}>
                  {GROUP_LABEL[g]}
                </Chip>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {recommendations.length > 0 && (
            <div className="mb-3 px-2">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recommended</div>
              <div className="space-y-1">
                {recommendations.map((ex) => (
                  <ExerciseRow key={ex.id} ex={ex} onPick={() => { onPick(ex); onOpenChange(false); }} highlight />
                ))}
              </div>
              <div className="mt-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">All exercises</div>
            </div>
          )}

          <div className="space-y-1 px-2">
            {results.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} onPick={() => { onPick(ex); onOpenChange(false); }} />
            ))}
            {results.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matches.
                {q.trim() && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={handleAddCustom} disabled={adding} className="tap-44">
                      <Plus className="h-4 w-4 mr-1.5" /> Add "{q.trim()}" as custom
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ExerciseRow({ ex, onPick, highlight }: { ex: Exercise; onPick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onPick}
      className={`w-full flex items-center justify-between rounded-xl px-3 py-3 tap-56 text-left transition-colors ${
        highlight ? "bg-accent/10 hover:bg-accent/20" : "hover:bg-surface-2"
      }`}
    >
      <div>
        <div className="font-semibold text-sm">{ex.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{ex.muscle_group}{ex.is_custom ? " · custom" : ""}</div>
      </div>
    </button>
  );
}
