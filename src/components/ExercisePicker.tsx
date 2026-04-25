import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useExercises, type Exercise } from "@/hooks/useExercises";
import { Search, Plus, ChevronLeft, Sparkles } from "lucide-react";
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
  const [q, setQ] = useState("");
  const [activeGroup, setActiveGroup] = useState<Exercise["muscle_group"] | "all">(suggestForGroup ?? "all");
  const [view, setView] = useState<"list" | "create">("list");

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

  const close = () => {
    setQ("");
    setView("list");
    onOpenChange(false);
  };

  const handleCreated = async (ex: Exercise) => {
    await refresh();
    onPick(ex);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md p-0 gap-0 h-[85vh] flex flex-col">
        {view === "list" ? (
          <>
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
              {/* Always-available create button */}
              <div className="px-2 mb-3">
                <button
                  onClick={() => setView("create")}
                  className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 px-3 py-3 text-left tap-56 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Plus className="h-5 w-5" strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">New custom exercise</div>
                    <div className="text-xs text-muted-foreground">
                      e.g. Cable rope curl, Tricep pushdown (rope)
                    </div>
                  </div>
                </button>
              </div>

              {recommendations.length > 0 && (
                <div className="mb-3 px-2">
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recommended</div>
                  <div className="space-y-1">
                    {recommendations.map((ex) => (
                      <ExerciseRow key={ex.id} ex={ex} onPick={() => { onPick(ex); close(); }} highlight />
                    ))}
                  </div>
                  <div className="mt-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">All exercises</div>
                </div>
              )}

              <div className="space-y-1 px-2">
                {results.map((ex) => (
                  <ExerciseRow key={ex.id} ex={ex} onPick={() => { onPick(ex); close(); }} />
                ))}
                {results.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No matches{q.trim() ? ` for "${q.trim()}"` : ""}.
                    {q.trim() && (
                      <div className="mt-4">
                        <Button onClick={() => setView("create")} className="tap-44 bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
                          <Plus className="h-4 w-4 mr-1.5" /> Create "{q.trim()}"
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <CreateExerciseForm
            initialName={q.trim()}
            initialGroup={activeGroup === "all" ? (suggestForGroup ?? "arms") : activeGroup}
            onCancel={() => setView("list")}
            onCreated={handleCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateExerciseForm({
  initialName, initialGroup, onCancel, onCreated,
}: {
  initialName: string;
  initialGroup: Exercise["muscle_group"];
  onCancel: () => void;
  onCreated: (ex: Exercise) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<Exercise["muscle_group"]>(initialGroup);
  const [isCompound, setIsCompound] = useState(false);
  const [aliases, setAliases] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user) {
      toast.error("Give the exercise a name");
      return;
    }
    setSaving(true);
    const aliasList = aliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        name: trimmed,
        muscle_group: group,
        aliases: aliasList,
        is_compound: isCompound,
        is_custom: true,
        owner_id: user.id,
      })
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added "${trimmed}"`);
    onCreated(data as any);
  };

  return (
    <>
      <DialogHeader className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="-ml-2 flex items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground tap-44"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <DialogTitle className="text-xl font-bold mt-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" /> New exercise
        </DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <Label htmlFor="ex-name" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Name
          </Label>
          <Input
            id="ex-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cable rope curl"
            className="mt-1.5 tap-44 text-base"
          />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Muscle group</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tap-44 transition-colors ${
                  group === g ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="ex-aliases" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Search aliases <span className="normal-case text-muted-foreground/70">(optional, comma-separated)</span>
          </Label>
          <Input
            id="ex-aliases"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="rope curl, cable curl"
            className="mt-1.5 tap-44"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Helps you find this exercise later when searching.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[hsl(var(--accent))]"
          />
          <div>
            <div className="font-semibold text-sm">Compound movement</div>
            <div className="text-xs text-muted-foreground">
              Multi-joint lifts (squat, bench, row). Used to nudge weight by 5 lbs instead of 2.5 when you hit all reps.
            </div>
          </div>
        </label>
      </div>

      <div className="border-t border-border px-4 py-3 pb-safe">
        <Button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
        >
          {saving ? "Adding…" : "Add to catalog"}
        </Button>
      </div>
    </>
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
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm break-words">{ex.name}</div>
        <div className="text-xs text-muted-foreground capitalize">
          {ex.muscle_group}{ex.is_custom ? " · custom" : ""}
        </div>
      </div>
    </button>
  );
}
