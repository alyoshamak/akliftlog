CREATE TABLE public.exercise_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL,
  session_id UUID,
  note TEXT NOT NULL DEFAULT '',
  difficulty SMALLINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_notes_select_own"
ON public.exercise_notes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "exercise_notes_insert_own"
ON public.exercise_notes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "exercise_notes_update_own"
ON public.exercise_notes FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "exercise_notes_delete_own"
ON public.exercise_notes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_exercise_notes_user_ex ON public.exercise_notes(user_id, exercise_id, created_at DESC);