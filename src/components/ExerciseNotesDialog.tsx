import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Trash2, Flame } from "lucide-react";

type Note = {
  id: string;
  note: string;
  difficulty: number | null;
  created_at: string;
};

export default function ExerciseNotesDialog({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exerciseId: string;
  exerciseName: string;
  sessionId?: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user || !exerciseId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("exercise_notes")
        .select("id, note, difficulty, created_at")
        .eq("user_id", user.id)
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setNotes((data as Note[]) ?? []);
      setLoading(false);
    })();
  }, [open, user, exerciseId]);

  const save = async () => {
    if (!user) return;
    if (!text.trim() && difficulty == null) {
      toast.error("Add a note or pick a difficulty.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("exercise_notes")
      .insert({
        user_id: user.id,
        exercise_id: exerciseId,
        session_id: sessionId ?? null,
        note: text.trim(),
        difficulty,
      })
      .select("id, note, difficulty, created_at")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    setNotes([data as Note, ...notes]);
    setText("");
    setDifficulty(null);
    toast.success("Note saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("exercise_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setNotes(notes.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    if (!user || notes.length === 0) return;
    if (!confirm(`Delete all ${notes.length} notes for ${exerciseName}?`)) return;
    const { error } = await supabase
      .from("exercise_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId);
    if (error) return toast.error(error.message);
    setNotes([]);
    toast.success("All notes cleared");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">{exerciseName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="How did it feel? Form cues, pain, PRs…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Difficulty
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setDifficulty(difficulty === n ? null : n)}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold tap-44 border ${
                    difficulty === n
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" /> {n}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">1 = easy · 5 = brutal</div>
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="w-full bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
          >
            {saving ? "Saving…" : "Save note"}
          </Button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              History {notes.length > 0 && `(${notes.length})`}
            </div>
            {notes.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-destructive hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No notes yet.
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-secondary/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      {format(new Date(n.created_at), "MMM d, yyyy")} ·{" "}
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </div>
                    <button
                      onClick={() => remove(n.id)}
                      className="text-muted-foreground hover:text-destructive tap-44"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {n.difficulty != null && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent">
                      <Flame className="h-3 w-3" /> {n.difficulty}/5
                    </div>
                  )}
                  {n.note && (
                    <div className="text-sm mt-1 whitespace-pre-wrap">{n.note}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
