ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'custom';

ALTER TABLE public.workout_plans
  DROP CONSTRAINT IF EXISTS workout_plans_source_check;

ALTER TABLE public.workout_plans
  ADD CONSTRAINT workout_plans_source_check
  CHECK (source IN ('custom','template','upload','influencer'));