import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { fetchLastPerformanceMap, suggestSet, type LastPerformance } from "@/lib/lastPerformance";
import { ChevronLeft, MoreHorizontal, Plus, Check, Replace, Trash2, GripVertical, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseNotesDialog from "@/components/ExerciseNotesDialog";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, KeyboardSensor,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "@/hooks/useExercises";

type SessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  superset_group: number | null;
  exercise: { id: string; name: string; muscle_group: string; is_compound: boolean };
};

type SetRow = {
  id?: string; // db id once saved
  set_number: number;
  weight: number;
  reps: number;
  unit: "lb" | "kg";
  completed: boolean;
};

export default function Session() {
  const { id: sessionId } = useParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const nav = useNavigate();
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SetRow[]>>({});
  const [last, setLast] = useState<Record<string, LastPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<{ id: string; name: string } | null>(null);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [reorderMode, setReorderMode] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const unit = profile?.unit_pref ?? "lb";
  const goal = profile?.goal ?? "hypertrophy";

  // Load session
  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      setLoading(true);
      const { data: session } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

      if (session?.finished_at) {
        // already finished — read-only style: redirect to home for now
        toast.info("This workout is already finished.");
        nav("/", { replace: true });
        return;
      }
      setStartedAt(session?.started_at ?? null);

      const { data: exs } = await supabase
        .from("session_exercises")
        .select("*, exercise:exercises(id, name, muscle_group, is_compound)")
        .eq("session_id", sessionId)
        .order("position");
      const exList = (exs as any[]) ?? [];
      setExercises(exList);

      // load existing sets for this session
      const seIds = exList.map((e) => e.id);
      let existing: any[] = [];
      if (seIds.length > 0) {
        const { data: setsData } = await supabase
          .from("session_sets")
          .select("*")
          .in("session_exercise_id", seIds)
          .order("set_number");
        existing = setsData ?? [];
      }

      // Last performance map
      const lastMap = await fetchLastPerformanceMap(user.id, exList.map((e) => e.exercise_id));
      setLast(lastMap);

      // Note counts per exercise
      const exerciseIds = exList.map((e) => e.exercise_id);
      if (exerciseIds.length > 0) {
        const { data: notesData } = await supabase
          .from("exercise_notes")
          .select("exercise_id")
          .eq("user_id", user.id)
          .in("exercise_id", exerciseIds);
        const counts: Record<string, number> = {};
        for (const n of (notesData ?? []) as { exercise_id: string }[]) {
          counts[n.exercise_id] = (counts[n.exercise_id] ?? 0) + 1;
        }
        setNoteCounts(counts);
      }

      // Build set rows
      const rows: Record<string, SetRow[]> = {};
      for (const ex of exList) {
        const existingForEx = existing.filter((s) => s.session_exercise_id === ex.id);
        const lp = lastMap[ex.exercise_id];
        const target = ex.target_sets;
        const out: SetRow[] = [];
        for (let i = 0; i < target; i++) {
          const found = existingForEx.find((s) => s.set_number === i + 1);
          if (found) {
            out.push({
              id: found.id,
              set_number: i + 1,
              weight: Number(found.weight),
              reps: found.reps,
              unit: found.unit,
              completed: true,
            });
          } else {
            const s = suggestSet(lp, ex.target_reps, i, { isCompound: ex.exercise.is_compound, goal });
            out.push({
              set_number: i + 1,
              weight: s.weight,
              reps: s.reps,
              unit,
              completed: false,
            });
          }
        }
        rows[ex.id] = out;
      }
      setSetsByExercise(rows);
      setLoading(false);
    })();
  }, [sessionId, user?.id]);

  const updateSet = (exId: string, idx: number, patch: Partial<SetRow>) => {
    setSetsByExercise((prev) => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const checkOff = async (ex: SessionExercise, idx: number) => {
    const row = setsByExercise[ex.id][idx];
    if (row.completed) {
      // un-check: delete it
      if (row.id) {
        await supabase.from("session_sets").delete().eq("id", row.id);
      }
      updateSet(ex.id, idx, { completed: false, id: undefined });
      return;
    }
    const { data, error } = await supabase
      .from("session_sets")
      .insert({
        session_exercise_id: ex.id,
        set_number: row.set_number,
        weight: row.weight,
        reps: row.reps,
        unit: row.unit,
      })
      .select()
      .maybeSingle();
    if (error) return toast.error(error.message);
    // Mark this set complete and pre-fill the next uncompleted set with same weight/reps
    setSetsByExercise((prev) => {
      const cur = prev[ex.id] ?? [];
      const updated = cur.map((s, i) => {
        if (i === idx) return { ...s, completed: true, id: data?.id };
        if (i === idx + 1 && !s.completed) {
          return { ...s, weight: row.weight, reps: row.reps, unit: row.unit };
        }
        return s;
      });
      return { ...prev, [ex.id]: updated };
    });
  };

  const addSetRow = (ex: SessionExercise) => {
    const cur = setsByExercise[ex.id] ?? [];
    const last = cur[cur.length - 1];
    setSetsByExercise({
      ...setsByExercise,
      [ex.id]: [...cur, {
        set_number: cur.length + 1,
        weight: last?.weight ?? 0,
        reps: last?.reps ?? ex.target_reps,
        unit,
        completed: false,
      }],
    });
  };

  const removeExercise = async (exId: string) => {
    if (!confirm("Remove this exercise from the workout?")) return;
    await supabase.from("session_exercises").delete().eq("id", exId);
    setExercises(exercises.filter((e) => e.id !== exId));
    const { [exId]: _, ...rest } = setsByExercise;
    setSetsByExercise(rest);
  };

  const swapExercise = async (oldExId: string, newExercise: Exercise) => {
    if (!sessionId || !user) return;
    // Update the session_exercise to point at the new exercise; clear sets
    const oldEx = exercises.find((e) => e.id === oldExId);
    if (!oldEx) return;
    await supabase.from("session_sets").delete().eq("session_exercise_id", oldExId);
    const { data, error } = await supabase
      .from("session_exercises")
      .update({ exercise_id: newExercise.id })
      .eq("id", oldExId)
      .select("*, exercise:exercises(id, name, muscle_group, is_compound)")
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Could not swap");
    setExercises(exercises.map((e) => (e.id === oldExId ? (data as any) : e)));

    // Re-fetch last + suggest
    const lastMap = await fetchLastPerformanceMap(user.id, [newExercise.id]);
    setLast({ ...last, [newExercise.id]: lastMap[newExercise.id] });
    const newLast = lastMap[newExercise.id];
    const newRows: SetRow[] = [];
    for (let i = 0; i < oldEx.target_sets; i++) {
      const s = suggestSet(newLast, oldEx.target_reps, i, { isCompound: (data as any).exercise.is_compound, goal });
      newRows.push({ set_number: i + 1, weight: s.weight, reps: s.reps, unit, completed: false });
    }
    setSetsByExercise({ ...setsByExercise, [oldExId]: newRows });
  };

  const addExercise = async (ex: Exercise) => {
    if (!sessionId || !user) return;
    const pos = exercises.length;
    const { data, error } = await supabase
      .from("session_exercises")
      .insert({
        session_id: sessionId,
        exercise_id: ex.id,
        position: pos,
        target_sets: 3,
        target_reps: 10,
      })
      .select("*, exercise:exercises(id, name, muscle_group, is_compound)")
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Could not add");
    setExercises([...exercises, data as any]);

    const lastMap = await fetchLastPerformanceMap(user.id, [ex.id]);
    setLast({ ...last, [ex.id]: lastMap[ex.id] });
    const newLast = lastMap[ex.id];
    const rows: SetRow[] = [];
    for (let i = 0; i < 3; i++) {
      const s = suggestSet(newLast, 10, i, { isCompound: (data as any).exercise.is_compound, goal });
      rows.push({ set_number: i + 1, weight: s.weight, reps: s.reps, unit, completed: false });
    }
    setSetsByExercise({ ...setsByExercise, [data.id]: rows });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = exercises.findIndex((e) => e.id === active.id);
    const newIdx = exercises.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(exercises, oldIdx, newIdx);
    setExercises(reordered);
    await Promise.all(
      reordered.map((e, i) => supabase.from("session_exercises").update({ position: i }).eq("id", e.id))
    );
  };

  const finishWorkout = async () => {
    if (!sessionId) return;
    setFinishing(true);
    const completedCount = Object.values(setsByExercise).reduce(
      (acc, rows) => acc + rows.filter((r) => r.completed).length, 0
    );
    if (completedCount === 0) {
      if (!confirm("No sets logged. Discard this workout?")) {
        setFinishing(false);
        return;
      }
      await supabase.from("workout_sessions").delete().eq("id", sessionId);
      toast.success("Discarded.");
      setFinishing(false);
      nav("/", { replace: true });
      return;
    }
    await supabase.from("workout_sessions").update({ finished_at: new Date().toISOString() }).eq("id", sessionId);
    toast.success(`Done. ${completedCount} sets logged.`);
    setFinishing(false);
    nav("/", { replace: true });
  };

  const cancelWorkout = async () => {
    if (!sessionId) return;
    if (!confirm("Discard this workout? All logged sets will be lost.")) return;
    await supabase.from("workout_sessions").delete().eq("id", sessionId);
    nav("/", { replace: true });
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></div>;
  }

  const swapEx = exercises.find((e) => e.id === swapForId);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pt-safe">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={cancelWorkout} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 px-2">
            <ChevronLeft className="h-4 w-4" /> Cancel
          </button>
          <div className="text-xs text-muted-foreground">
            {startedAt && <span>Started {formatDistanceToNow(new Date(startedAt))} ago</span>}
          </div>
          <button
            onClick={() => setReorderMode(!reorderMode)}
            className={`text-xs font-bold tap-44 px-2 ${reorderMode ? "text-accent" : "text-muted-foreground"}`}
          >
            {reorderMode ? "Done" : "Reorder"}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 pt-3">
              {exercises.map((ex, i) => {
                const prev = exercises[i - 1];
                const next = exercises[i + 1];
                const linkedToPrev = prev && prev.superset_group != null && prev.superset_group === ex.superset_group;
                const linkedToNext = next && next.superset_group != null && next.superset_group === ex.superset_group;
                const inSuperset = linkedToPrev || linkedToNext;
                let letter: string | null = null;
                if (inSuperset) {
                  let pos = 0;
                  for (let k = i; k >= 0; k--) {
                    if (exercises[k].superset_group === ex.superset_group) pos++;
                    else break;
                  }
                  letter = String.fromCharCode(64 + pos);
                }
                const card = (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    sets={setsByExercise[ex.id] ?? []}
                    last={last[ex.exercise_id]}
                    reorderMode={reorderMode}
                    supersetLetter={letter}
                    onCheck={(idx) => checkOff(ex, idx)}
                    onChangeWeight={(idx, w) => updateSet(ex.id, idx, { weight: w })}
                    onChangeReps={(idx, r) => updateSet(ex.id, idx, { reps: r })}
                    onAddSet={() => addSetRow(ex)}
                    onSwap={() => setSwapForId(ex.id)}
                    onRemove={() => removeExercise(ex.id)}
                    onNotes={() => setNotesFor({ id: ex.exercise_id, name: ex.exercise.name })}
                  />
                );
                // Open wrapper at start of group
                if (inSuperset && !linkedToPrev) {
                  // find end of group
                  let endIdx = i;
                  while (endIdx + 1 < exercises.length && exercises[endIdx + 1].superset_group === ex.superset_group) endIdx++;
                  // Render the entire group here in a single wrapper
                  return (
                    <div key={`grp-${ex.superset_group}-${i}`} className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-2 space-y-3">
                      <div className="flex items-center justify-between px-2 pt-1">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-accent">
                          Superset · alternate sets
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {endIdx - i + 1} exercises
                        </div>
                      </div>
                      {exercises.slice(i, endIdx + 1).map((gex, gi) => {
                        const gLetter = String.fromCharCode(65 + gi);
                        return (
                          <ExerciseCard
                            key={gex.id}
                            ex={gex}
                            sets={setsByExercise[gex.id] ?? []}
                            last={last[gex.exercise_id]}
                            reorderMode={reorderMode}
                            supersetLetter={gLetter}
                            onCheck={(idx) => checkOff(gex, idx)}
                            onChangeWeight={(idx, w) => updateSet(gex.id, idx, { weight: w })}
                            onChangeReps={(idx, r) => updateSet(gex.id, idx, { reps: r })}
                            onAddSet={() => addSetRow(gex)}
                            onSwap={() => setSwapForId(gex.id)}
                            onRemove={() => removeExercise(gex.id)}
                            onNotes={() => setNotesFor({ id: gex.exercise_id, name: gex.exercise.name })}
                          />
                        );
                      })}
                    </div>
                  );
                }
                // Skip rendering of items already rendered inside their group's wrapper
                if (linkedToPrev) return null;
                return card;
              })}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={() => { setSwapForId(null); setPickerOpen(true); }}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-accent tap-56"
        >
          <Plus className="inline h-4 w-4 mr-1" /> Add exercise
        </button>
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border pb-safe">
        <div className="mx-auto max-w-md px-4 pt-3">
          <Button
            onClick={finishWorkout}
            disabled={finishing}
            className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold text-base accent-glow"
          >
            {finishing ? "Saving…" : "Finish Workout"}
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen || !!swapForId}
        onOpenChange={(o) => { if (!o) { setPickerOpen(false); setSwapForId(null); } }}
        suggestForGroup={swapEx?.exercise.muscle_group as any}
        excludeIds={exercises.map((e) => e.exercise_id)}
        onPick={(ex) => {
          if (swapForId) {
            swapExercise(swapForId, ex);
          } else {
            addExercise(ex);
          }
        }}
      />

      {notesFor && (
        <ExerciseNotesDialog
          open={!!notesFor}
          onOpenChange={(o) => { if (!o) setNotesFor(null); }}
          exerciseId={notesFor.id}
          exerciseName={notesFor.name}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

function ExerciseCard({
  ex, sets, last, reorderMode, supersetLetter, onCheck, onChangeWeight, onChangeReps, onAddSet, onSwap, onRemove, onNotes,
}: {
  ex: SessionExercise;
  sets: SetRow[];
  last?: LastPerformance;
  reorderMode: boolean;
  supersetLetter?: string | null;
  onCheck: (idx: number) => void;
  onChangeWeight: (idx: number, w: number) => void;
  onChangeReps: (idx: number, r: number) => void;
  onAddSet: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onNotes: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const lastSummary = useMemo(() => {
    if (!last) return null;
    const setsStr = last.sets.map((s) => `${s.weight}×${s.reps}`).join(", ");
    return `${setsStr} · ${formatDistanceToNow(new Date(last.performed_at))} ago`;
  }, [last]);

  return (
    <div ref={setNodeRef} style={style} className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-3">
        {reorderMode && (
          <button {...attributes} {...listeners} className="text-muted-foreground touch-none cursor-grab active:cursor-grabbing tap-44">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {supersetLetter && (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground text-xs font-extrabold">
            {supersetLetter}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{ex.exercise.name}</div>
          {lastSummary ? (
            <div className="text-xs text-muted-foreground truncate">Last: {lastSummary}</div>
          ) : (
            <div className="text-xs text-muted-foreground">First time</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground tap-44">
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNotes}>
              <StickyNote className="h-4 w-4 mr-2" /> Add/View notes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSwap}>
              <Replace className="h-4 w-4 mr-2" /> Swap exercise
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-2 pb-2">
        <div className="grid grid-cols-[28px_1fr_1fr_56px] items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <div>Set</div>
          <div>Weight ({sets[0]?.unit ?? "lb"})</div>
          <div>Reps</div>
          <div className="text-right">Done</div>
        </div>
        {sets.map((s, i) => (
          <SetRowUI
            key={i}
            row={s}
            onChangeWeight={(w) => onChangeWeight(i, w)}
            onChangeReps={(r) => onChangeReps(i, r)}
            onCheck={() => onCheck(i)}
          />
        ))}
        <button
          onClick={onAddSet}
          className="mt-1 ml-2 text-xs text-muted-foreground hover:text-foreground tap-44 px-2"
        >
          <Plus className="inline h-3 w-3" /> Add set
        </button>
      </div>
    </div>
  );
}

function SetRowUI({
  row, onChangeWeight, onChangeReps, onCheck,
}: {
  row: SetRow;
  onChangeWeight: (w: number) => void;
  onChangeReps: (r: number) => void;
  onCheck: () => void;
}) {
  return (
    <div className={`grid grid-cols-[28px_1fr_1fr_56px] items-center gap-2 px-2 py-1.5 rounded-lg ${row.completed ? "bg-accent/10" : ""}`}>
      <div className="text-sm font-bold num text-muted-foreground">{row.set_number}</div>
      <NumberInput value={row.weight} onChange={onChangeWeight} step={2.5} disabled={row.completed} />
      <NumberInput value={row.reps} onChange={onChangeReps} step={1} disabled={row.completed} integer />
      <div className="flex justify-end">
        <button
          onClick={onCheck}
          aria-label={row.completed ? "Uncheck set" : "Check set"}
          className={`flex h-11 w-11 items-center justify-center rounded-xl tap-44 transition-all ${
            row.completed
              ? "bg-accent text-accent-foreground check-burst"
              : "bg-secondary text-muted-foreground hover:bg-surface-3"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function NumberInput({
  value, onChange, step, disabled, integer,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  disabled?: boolean;
  integer?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const v = e.target.value === "" ? 0 : Number(e.target.value);
        onChange(integer ? Math.round(v) : v);
      }}
      className="w-full bg-secondary rounded-lg px-2.5 py-2.5 text-base font-bold num text-center tap-44 disabled:opacity-70"
    />
  );
}
