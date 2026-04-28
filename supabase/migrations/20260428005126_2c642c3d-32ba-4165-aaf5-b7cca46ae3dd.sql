CREATE TABLE public.body_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  weight NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lb',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.body_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_weights_select_own" ON public.body_weights
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "body_weights_insert_own" ON public.body_weights
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "body_weights_update_own" ON public.body_weights
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "body_weights_delete_own" ON public.body_weights
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_body_weights_user_recorded ON public.body_weights(user_id, recorded_at DESC);