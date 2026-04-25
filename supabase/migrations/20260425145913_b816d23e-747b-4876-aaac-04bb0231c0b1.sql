ALTER TABLE public.plan_day_exercises ADD COLUMN superset_group integer;
ALTER TABLE public.session_exercises ADD COLUMN superset_group integer;
CREATE INDEX IF NOT EXISTS idx_pde_superset ON public.plan_day_exercises(day_id, superset_group);
CREATE INDEX IF NOT EXISTS idx_se_superset ON public.session_exercises(session_id, superset_group);