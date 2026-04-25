
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  goal TEXT NOT NULL DEFAULT 'hypertrophy' CHECK (goal IN ('hypertrophy','strength','endurance')),
  unit_pref TEXT NOT NULL DEFAULT 'lb' CHECK (unit_pref IN ('lb','kg')),
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light','system')),
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Exercises (seed + custom)
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN ('chest','back','legs','shoulders','arms','core')),
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_compound BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exercises_muscle_group_idx ON public.exercises(muscle_group);
CREATE INDEX exercises_owner_idx ON public.exercises(owner_id);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can read seed exercises (owner_id IS NULL) and their own customs.
CREATE POLICY "exercises_select" ON public.exercises FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "exercises_insert_own" ON public.exercises FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_custom = true);
CREATE POLICY "exercises_update_own" ON public.exercises FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "exercises_delete_own" ON public.exercises FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Workout plans
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Plan',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_own" ON public.workout_plans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_number)
);
CREATE INDEX plan_days_plan_idx ON public.plan_days(plan_id);
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_days_own" ON public.plan_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

CREATE TABLE public.plan_day_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES public.plan_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  position INT NOT NULL DEFAULT 0,
  target_sets INT NOT NULL DEFAULT 3,
  target_reps INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pde_day_idx ON public.plan_day_exercises(day_id);
ALTER TABLE public.plan_day_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pde_own" ON public.plan_day_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.plan_days d
    JOIN public.workout_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.plan_days d
    JOIN public.workout_plans p ON p.id = d.plan_id
    WHERE d.id = day_id AND p.user_id = auth.uid()
  ));

-- Sessions
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_day_id UUID REFERENCES public.plan_days(id) ON DELETE SET NULL,
  day_number INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX sessions_user_idx ON public.workout_sessions(user_id, started_at DESC);
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_own" ON public.workout_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  position INT NOT NULL DEFAULT 0,
  target_sets INT NOT NULL DEFAULT 3,
  target_reps INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX se_session_idx ON public.session_exercises(session_id);
CREATE INDEX se_exercise_idx ON public.session_exercises(exercise_id);
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "se_own" ON public.session_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE TABLE public.session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES public.session_exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  weight NUMERIC(6,2) NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'lb' CHECK (unit IN ('lb','kg')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sets_se_idx ON public.session_sets(session_exercise_id);
ALTER TABLE public.session_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sets_own" ON public.session_sets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.session_exercises se
    JOIN public.workout_sessions s ON s.id = se.session_id
    WHERE se.id = session_exercise_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.session_exercises se
    JOIN public.workout_sessions s ON s.id = se.session_id
    WHERE se.id = session_exercise_id AND s.user_id = auth.uid()
  ));

-- Storage bucket for plan uploads (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-uploads', 'plan-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "plan_uploads_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plan-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "plan_uploads_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "plan_uploads_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plan-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
