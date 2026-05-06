import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ExercisePicker from "@/components/ExercisePicker";
import ShareButton from "@/components/ShareButton";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, KeyboardSensor,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "@/hooks/useExercises";

type Day = { id: string; day_number: number; name: string | null };
type DayExercise = {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  superset_group: number | null;
  exercise: { id: string; name: string; muscle_group: string };
};

export default function Plan() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const firstTime = params.get("first") === "1";
  const askActive = params.get("askActive") === "1";

  const [planId, setPlanId] = useState<string | null>(params.get("planId"));
  const [planName, setPlanName] = useState("My Plan");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [days, setDays] = useState<Day[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<DayExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAskActive, setShowAskActive] = useState(false);

  // Load or create active plan
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      let pid = planId;
      if (!pid) {
        // No plan id provided — bounce back to the hub.
        nav("/plan", { replace: true });
        return;
      }
      const { data: p } = await supabase
        .from("workout_plans")
        .select("id, name, is_active")
        .eq("id", pid)
        .maybeSingle();
      if (!p) {
        nav("/plan", { replace: true });
        return;
      }
      setPlanName(p.name);
      setIsActive(!!p.is_active);
      if (askActive && !p.is_active) {
        // Check if another plan is active
        const { data: other } = await supabase
          .from("workout_plans")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .neq("id", pid)
          .limit(1)
          .maybeSingle();
        // Always prompt after creating a new plan, regardless of whether another active exists
        setShowAskActive(true);
      }
      await loadDays(pid);
      setLoading(false);
    })();
  }, [user]);

  const loadDays = async (pid: string) => {
    const { data } = await supabase
      .from("plan_days")
      .select("*")
      .eq("plan_id", pid)
      .order("day_number");
    const list = (data as Day[]) ?? [];
    setDays(list);
    if (list.length > 0 && !activeDayId) setActiveDayId(list[0].id);
  };

  const loadExercises = async (dayId: string) => {
    const { data } = await supabase
      .from("plan_day_exercises")
      .select("*, exercise:exercises(id, name, muscle_group)")
      .eq("day_id", dayId)
      .order("position");
    setExercises((data as any) ?? []);
  };

  useEffect(() => {
    if (activeDayId) loadExercises(activeDayId);
  }, [activeDayId]);

  const addDay = async () => {
    if (!planId) return;
    const nextNum = (days[days.length - 1]?.day_number ?? 0) + 1;
    const { data, error } = await supabase
      .from("plan_days")
      .insert({ plan_id: planId, day_number: nextNum, name: `Day ${nextNum}` })
      .select()
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) {
      setDays([...days, data as Day]);
      setActiveDayId((data as Day).id);
    }
  };

  const deleteDay = async (id: string) => {
    if (!confirm("Delete this day and all its exercises?")) return;
    await supabase.from("plan_days").delete().eq("id", id);
    const remaining = days.filter((d) => d.id !== id);
    setDays(remaining);
    if (activeDayId === id) setActiveDayId(remaining[0]?.id ?? null);
  };

  const renameDay = async (id: string, name: string) => {
    setDays(days.map((d) => (d.id === id ? { ...d, name } : d)));
    await supabase.from("plan_days").update({ name }).eq("id", id);
  };

  const renamePlan = async (name: string) => {
    setPlanName(name);
    if (planId) await supabase.from("workout_plans").update({ name }).eq("id", planId);
  };

  const onPickExercise = async (ex: Exercise) => {
    if (!activeDayId) return;
    const pos = exercises.length;
    const { data, error } = await supabase
      .from("plan_day_exercises")
      .insert({
        day_id: activeDayId,
        exercise_id: ex.id,
        position: pos,
        target_sets: 3,
        target_reps: 10,
      })
      .select("*, exercise:exercises(id, name, muscle_group)")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) setExercises([...exercises, data as any]);
  };

  const updateExercise = async (id: string, patch: Partial<Omit<DayExercise, "exercise">>) => {
    setExercises(exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await supabase.from("plan_day_exercises").update(patch).eq("id", id);
  };

  const removeExercise = async (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id));
    await supabase.from("plan_day_exercises").delete().eq("id", id);
  };

  // Toggle superset link between exercise at index i and i+1.
  // Linked consecutive rows share the same superset_group integer.
  const toggleSupersetWithNext = async (i: number) => {
    if (i < 0 || i >= exercises.length - 1) return;
    const a = exercises[i];
    const b = exercises[i + 1];
    const linked = a.superset_group != null && a.superset_group === b.superset_group;

    let next = [...exercises];
    if (linked) {
      // Unlink: clear b's group (and any further chain after b that matched).
      const grp = a.superset_group;
      // Walk forward from b while still in the same group, clear them.
      let j = i + 1;
      while (j < next.length && next[j].superset_group === grp) {
        next[j] = { ...next[j], superset_group: null };
        j++;
      }
      // If a is now the only one left with that group, clear it too.
      const stillLinked = next.some((e, idx) => idx !== i && e.superset_group === grp);
      if (!stillLinked) next[i] = { ...next[i], superset_group: null };
    } else {
      // Link: assign a shared group. Reuse a's group if it has one, else next available.
      let grp = a.superset_group;
      if (grp == null) {
        const used = new Set(next.map((e) => e.superset_group).filter((g): g is number => g != null));
        grp = 1;
        while (used.has(grp)) grp++;
        next[i] = { ...next[i], superset_group: grp };
      }
      next[i + 1] = { ...next[i + 1], superset_group: grp };
    }

    setExercises(next);
    // Persist any changes vs. original
    const changed = next.filter((e, idx) => e.superset_group !== exercises[idx].superset_group);
    await Promise.all(
      changed.map((e) =>
        supabase.from("plan_day_exercises").update({ superset_group: e.superset_group }).eq("id", e.id)
      )
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const daySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDayDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = days.findIndex((d) => d.id === active.id);
    const newIdx = days.findIndex((d) => d.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(days, oldIdx, newIdx).map((d, i) => ({
      ...d,
      day_number: i + 1,
    }));
    setDays(reordered);
    // Persist new day_numbers. Two-phase to avoid unique collisions if a constraint exists.
    await Promise.all(
      reordered.map((d, i) =>
        supabase.from("plan_days").update({ day_number: -(i + 1) }).eq("id", d.id)
      )
    );
    await Promise.all(
      reordered.map((d, i) =>
        supabase.from("plan_days").update({ day_number: i + 1 }).eq("id", d.id)
      )
    );
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = exercises.findIndex((e) => e.id === active.id);
    const newIdx = exercises.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(exercises, oldIdx, newIdx);

    // Normalize superset groups: any group that is no longer a contiguous
    // run of 2+ exercises gets cleared.
    const groupRuns = new Map<number, number>();
    for (let i = 0; i < reordered.length; i++) {
      const g = reordered[i].superset_group;
      if (g == null) continue;
      const prevG = i > 0 ? reordered[i - 1].superset_group : null;
      if (prevG !== g) groupRuns.set(g, (groupRuns.get(g) ?? 0));
      // count contiguous run length keyed by group only if no break has happened
    }
    // Re-scan to count contiguous runs and detect breaks.
    const orphanGroups = new Set<number>();
    const seenStarts = new Map<number, number>(); // group -> start index of current run
    for (let i = 0; i < reordered.length; i++) {
      const g = reordered[i].superset_group;
      if (g == null) continue;
      const prevG = i > 0 ? reordered[i - 1].superset_group : null;
      if (prevG !== g) {
        // new run start; if group seen before, it's a broken/split group
        if (seenStarts.has(g)) orphanGroups.add(g);
        seenStarts.set(g, i);
      }
    }
    // Also: a group whose only run has length 1 -> orphan
    const runLengths = new Map<number, number>();
    let curG: number | null = null;
    let curLen = 0;
    for (const e of reordered) {
      if (e.superset_group === curG && curG != null) {
        curLen++;
      } else {
        if (curG != null) runLengths.set(curG, Math.max(runLengths.get(curG) ?? 0, curLen));
        curG = e.superset_group;
        curLen = curG != null ? 1 : 0;
      }
    }
    if (curG != null) runLengths.set(curG, Math.max(runLengths.get(curG) ?? 0, curLen));
    for (const [g, len] of runLengths) if (len < 2) orphanGroups.add(g);

    const normalized = reordered.map((e) =>
      e.superset_group != null && orphanGroups.has(e.superset_group)
        ? { ...e, superset_group: null }
        : e
    );

    setExercises(normalized);
    await Promise.all(
      normalized.map((e, i) => {
        const orig = exercises.find((x) => x.id === e.id);
        const patch: any = { position: i };
        if (orig && orig.superset_group !== e.superset_group) patch.superset_group = e.superset_group;
        return supabase.from("plan_day_exercises").update(patch).eq("id", e.id);
      })
    );
  };

  const goBack = () => nav("/plan");

  const setThisActive = async () => {
    if (!user || !planId) return;
    await supabase.from("workout_plans").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("workout_plans").update({ is_active: true }).eq("id", planId);
    setIsActive(true);
    setShowAskActive(false);
    toast.success(`Active plan: ${planName}`);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center pt-20"><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></div>
      </AppShell>
    );
  }

  const activeDay = days.find((d) => d.id === activeDayId);

  return (
    <AppShell>
      <div className="px-4 pt-safe">
        <div className="flex items-center justify-between pt-3">
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2">
            <ChevronLeft className="h-4 w-4" /> Plans
          </button>
          <div className="flex items-center gap-1">
            {planId && <ShareButton planId={planId} planName={planName} planDescription={null} />}
            {firstTime && (
              <Button size="sm" onClick={goBack} className="bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
                Done <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <input
          value={planName}
          onChange={(e) => renamePlan(e.target.value)}
          className="mt-3 w-full bg-transparent text-3xl font-extrabold tracking-tight focus:outline-none"
        />
        <p className="text-sm text-muted-foreground">{days.length} {days.length === 1 ? "day" : "days"}</p>

        {/* Day tabs */}
        <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1">
          <div className="flex w-max items-center gap-2">
            <DndContext sensors={daySensors} collisionDetection={closestCenter} onDragEnd={onDayDragEnd}>
              <SortableContext items={days.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
                {days.map((d) => (
                  <SortableDayTab
                    key={d.id}
                    day={d}
                    active={activeDayId === d.id}
                    onSelect={() => setActiveDayId(d.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addDay}
              className="shrink-0 rounded-xl border-2 border-dashed border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground tap-44"
            >
              <Plus className="inline h-4 w-4 mr-1" /> Day
            </button>
          </div>
        </div>

        {activeDay && (
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <Input
                value={activeDay.name ?? ""}
                onChange={(e) => renameDay(activeDay.id, e.target.value)}
                placeholder={`Day ${activeDay.day_number} name`}
                className="font-bold tap-44"
              />
              <button
                onClick={() => deleteDay(activeDay.id)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive tap-44"
                aria-label="Delete day"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                  {exercises.map((e, i) => {
                    const prev = exercises[i - 1];
                    const next = exercises[i + 1];
                    const linkedToPrev = prev && prev.superset_group != null && prev.superset_group === e.superset_group;
                    const linkedToNext = next && next.superset_group != null && next.superset_group === e.superset_group;
                    // letter label within group
                    let letter: string | null = null;
                    if (e.superset_group != null) {
                      let pos = 0;
                      for (let k = i; k >= 0; k--) {
                        if (exercises[k].superset_group === e.superset_group) pos++;
                        else break;
                      }
                      letter = String.fromCharCode(64 + pos); // 1->A
                    }
                    return (
                      <div key={e.id}>
                        <div
                          className={
                            e.superset_group != null
                              ? `relative ${linkedToPrev ? "" : "rounded-t-xl border-t-2"} ${linkedToNext ? "" : "rounded-b-xl border-b-2"} border-x-2 border-accent/60 bg-accent/5 px-2 ${linkedToPrev ? "-mt-2 pt-0" : "pt-1"} pb-1`
                              : ""
                          }
                        >
                          {e.superset_group != null && !linkedToPrev && (
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                              Superset
                            </div>
                          )}
                          <SortableRow
                            item={e}
                            onUpdate={updateExercise}
                            onRemove={removeExercise}
                            supersetLetter={letter}
                            canLinkNext={!!next}
                            linkedToNext={!!linkedToNext}
                            onToggleSuperset={() => toggleSupersetWithNext(i)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>

              <button
                onClick={() => setPickerOpen(true)}
                className="w-full rounded-xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-accent tap-56"
              >
                <Plus className="inline h-4 w-4 mr-1" /> Add exercise
              </button>
            </div>
          </div>
        )}

        {days.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-muted-foreground mb-4">Start by adding a workout day.</p>
            <Button onClick={addDay} className="tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
              <Plus className="h-4 w-4 mr-1" /> Add Day 1
            </Button>
          </div>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={onPickExercise}
        excludeIds={exercises.map((e) => e.exercise_id)}
      />

      <AlertDialog open={showAskActive} onOpenChange={(o) => !o && setShowAskActive(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set this as your active plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Your active plan drives the home screen's "Next Up" and "Start Workout" buttons. You can switch any time from the Plans tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAskActive(false)}>Save for Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={setThisActive}
              className="bg-accent text-accent-foreground hover:bg-accent-glow"
            >
              Set as Active
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SortableDayTab({ day, active, onSelect }: { day: Day; active: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shrink-0 inline-flex items-center rounded-xl pr-3 pl-1 py-1 text-sm font-bold transition-colors ${
        active ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Drag Day ${day.day_number}`}
        className={`flex h-9 w-7 items-center justify-center touch-none cursor-grab active:cursor-grabbing ${
          active ? "text-accent-foreground/70" : "text-muted-foreground"
        }`}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        onClick={onSelect}
        className="tap-44 px-1 py-1.5"
      >
        Day {day.day_number}
      </button>
    </div>
  );
}

function SortableRow({
  item, onUpdate, onRemove, supersetLetter, canLinkNext, linkedToNext, onToggleSuperset,
}: {
  item: DayExercise;
  onUpdate: (id: string, patch: Partial<Omit<DayExercise, "exercise">>) => void;
  onRemove: (id: string) => void;
  supersetLetter?: string | null;
  canLinkNext?: boolean;
  linkedToNext?: boolean;
  onToggleSuperset?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="surface-card p-3 relative">
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="flex h-10 w-8 shrink-0 items-center justify-center text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-1.5">
            {supersetLetter && (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground text-[11px] font-extrabold">
                {supersetLetter}
              </span>
            )}
            <div className="font-semibold text-sm leading-tight break-words">{item.exercise.name}</div>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground capitalize">{item.exercise.muscle_group}</div>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive tap-44"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 pl-10">
        {canLinkNext ? (
          <button
            onClick={onToggleSuperset}
            aria-label={linkedToNext ? "Unlink superset with next exercise" : "Superset with next exercise"}
            title={linkedToNext ? "Unlink superset" : "Superset with next"}
            className={`mr-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base italic font-extrabold tap-44 transition-all ${
              linkedToNext
                ? "bg-accent text-accent-foreground shadow-[0_0_12px_hsl(var(--accent)/0.6)]"
                : "bg-secondary text-muted-foreground hover:text-accent hover:bg-accent/10 border border-dashed border-border"
            }`}
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            S
          </button>
        ) : <div className="mr-auto w-8" />}
        <div className="flex items-center gap-1.5 min-w-0">
          <NumStepper
            value={item.target_sets}
            onChange={(v) => onUpdate(item.id, { target_sets: v })}
            min={1} max={10} suffix="sets"
          />
          <span className="text-muted-foreground text-xs">×</span>
          <NumStepper
            value={item.target_reps}
            onChange={(v) => onUpdate(item.id, { target_reps: v })}
            min={1} max={50} suffix="reps"
          />
        </div>
      </div>
    </div>
  );
}

function NumStepper({ value, onChange, min, max, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; suffix: string }) {
  return (
    <div className="flex items-center rounded-lg bg-secondary">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1.5 text-sm tap-44 font-bold"
        aria-label={`Decrease ${suffix}`}
      >−</button>
      <div className="w-7 text-center text-sm font-bold num">{value}</div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 py-1.5 text-sm tap-44 font-bold"
        aria-label={`Increase ${suffix}`}
      >+</button>
    </div>
  );
}
