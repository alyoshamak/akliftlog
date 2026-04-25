import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import ExercisePicker from "@/components/ExercisePicker";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, KeyboardSensor,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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
  exercise: { id: string; name: string; muscle_group: string };
};

export default function Plan() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const firstTime = params.get("first") === "1";

  const [planId, setPlanId] = useState<string | null>(params.get("planId"));
  const [planName, setPlanName] = useState("My Plan");
  const [days, setDays] = useState<Day[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<DayExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load or create active plan
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      let pid = planId;
      if (!pid) {
        const { data: existing } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          pid = existing.id;
          setPlanName(existing.name);
        } else {
          const { data: created } = await supabase
            .from("workout_plans")
            .insert({ user_id: user.id, name: "My Plan", is_active: true })
            .select()
            .maybeSingle();
          pid = created?.id ?? null;
        }
        if (pid) setPlanId(pid);
      } else {
        const { data: p } = await supabase.from("workout_plans").select("*").eq("id", pid).maybeSingle();
        if (p) setPlanName(p.name);
      }
      if (pid) await loadDays(pid);
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
      reordered.map((e, i) =>
        supabase.from("plan_day_exercises").update({ position: i }).eq("id", e.id)
      )
    );
  };

  const goHome = () => nav("/");

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
          <button onClick={goHome} className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2">
            <ChevronLeft className="h-4 w-4" /> Home
          </button>
          {firstTime && (
            <Button size="sm" onClick={goHome} className="bg-accent text-accent-foreground hover:bg-accent-glow font-bold">
              Done <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        <input
          value={planName}
          onChange={(e) => renamePlan(e.target.value)}
          className="mt-3 w-full bg-transparent text-3xl font-extrabold tracking-tight focus:outline-none"
        />
        <p className="text-sm text-muted-foreground">{days.length} {days.length === 1 ? "day" : "days"}</p>

        {/* Day tabs */}
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDayId(d.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors tap-44 ${
                activeDayId === d.id ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              Day {d.day_number}
            </button>
          ))}
          <button
            onClick={addDay}
            className="shrink-0 rounded-xl border-2 border-dashed border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground tap-44"
          >
            <Plus className="inline h-4 w-4 mr-1" /> Day
          </button>
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
                  {exercises.map((e) => (
                    <SortableRow key={e.id} item={e} onUpdate={updateExercise} onRemove={removeExercise} />
                  ))}
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
    </AppShell>
  );
}

function SortableRow({
  item, onUpdate, onRemove,
}: {
  item: DayExercise;
  onUpdate: (id: string, patch: Partial<Omit<DayExercise, "exercise">>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="surface-card p-3">
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
          <div className="font-semibold text-sm leading-tight break-words">{item.exercise.name}</div>
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
      <div className="mt-2 flex items-center justify-end gap-1.5 pl-10">
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
