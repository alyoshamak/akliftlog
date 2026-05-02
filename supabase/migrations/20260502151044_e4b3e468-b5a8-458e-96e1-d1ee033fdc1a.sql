
-- Username on profiles (optional, unique)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Profile shares
CREATE TABLE public.profile_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.profile_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_shares_public_select"
  ON public.profile_shares FOR SELECT
  USING (revoked_at IS NULL);

CREATE POLICY "profile_shares_owner_insert"
  ON public.profile_shares FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profile_shares_owner_update"
  ON public.profile_shares FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profile_shares_owner_delete"
  ON public.profile_shares FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Plan shares (snapshot)
CREATE TABLE public.plan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  source_plan_id uuid,
  plan_name text NOT NULL,
  plan_description text,
  shared_by_name text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.plan_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_shares_public_select"
  ON public.plan_shares FOR SELECT
  USING (revoked_at IS NULL);

CREATE POLICY "plan_shares_owner_all_select"
  ON public.plan_shares FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "plan_shares_owner_insert"
  ON public.plan_shares FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "plan_shares_owner_update"
  ON public.plan_shares FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "plan_shares_owner_delete"
  ON public.plan_shares FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_plan_shares_user ON public.plan_shares(user_id);
CREATE INDEX idx_plan_shares_source ON public.plan_shares(source_plan_id);

-- Public RPC: profile stats by share slug
CREATE OR REPLACE FUNCTION public.get_public_profile_stats(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_total int;
  v_streak int := 0;
  v_prs jsonb;
  v_top jsonb;
  v_active_plan jsonb;
  v_member_since timestamptz;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profile_shares
  WHERE slug = _slug AND revoked_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, display_name, username, created_at, unit_pref
    INTO v_profile
    FROM profiles WHERE id = v_user_id;

  v_member_since := v_profile.created_at;

  SELECT count(*) INTO v_total
    FROM workout_sessions
   WHERE user_id = v_user_id AND finished_at IS NOT NULL;

  -- Streak: consecutive days back from today (or yesterday) with a finished session
  WITH days AS (
    SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date AS d
      FROM workout_sessions
     WHERE user_id = v_user_id AND finished_at IS NOT NULL
  ),
  ordered AS (
    SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) - 1 AS rn FROM days
  ),
  start_anchor AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM days WHERE d = CURRENT_DATE) THEN CURRENT_DATE
      WHEN EXISTS (SELECT 1 FROM days WHERE d = CURRENT_DATE - 1) THEN CURRENT_DATE - 1
      ELSE NULL
    END AS s
  )
  SELECT COALESCE(count(*), 0)::int INTO v_streak
    FROM ordered, start_anchor
   WHERE start_anchor.s IS NOT NULL
     AND ordered.d = start_anchor.s - ordered.rn;

  -- PRs: best (heaviest) single set per key compound
  WITH targets AS (
    SELECT unnest(ARRAY['Bench Press','Back Squat','Deadlift','Overhead Press','Barbell Row']) AS name
  ),
  matched AS (
    SELECT t.name AS target_name, e.id AS exercise_id
    FROM targets t
    JOIN exercises e
      ON lower(e.name) = lower(t.name)
      OR lower(t.name) = ANY(SELECT lower(unnest(e.aliases)))
    WHERE (e.owner_id IS NULL OR e.owner_id = v_user_id)
  ),
  best AS (
    SELECT m.target_name,
           ss.weight, ss.reps, ss.unit, ss.completed_at,
           ROW_NUMBER() OVER (PARTITION BY m.target_name ORDER BY ss.weight DESC, ss.reps DESC) AS rn
      FROM matched m
      JOIN session_exercises se ON se.exercise_id = m.exercise_id
      JOIN workout_sessions ws ON ws.id = se.session_id AND ws.user_id = v_user_id AND ws.finished_at IS NOT NULL
      JOIN session_sets ss ON ss.session_exercise_id = se.id AND ss.weight > 0 AND ss.reps > 0
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'exercise', target_name,
    'weight', weight,
    'reps', reps,
    'unit', unit,
    'date', completed_at
  ) ORDER BY weight DESC), '[]'::jsonb) INTO v_prs
  FROM best WHERE rn = 1;

  -- Top 5 exercises by 30-day volume
  WITH vol AS (
    SELECT e.name, e.muscle_group, SUM(ss.weight * ss.reps) AS volume
      FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.session_id
      JOIN exercises e ON e.id = se.exercise_id
     WHERE ws.user_id = v_user_id
       AND ws.finished_at IS NOT NULL
       AND ws.finished_at >= now() - interval '30 days'
     GROUP BY e.name, e.muscle_group
     ORDER BY volume DESC
     LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', name, 'muscle_group', muscle_group, 'volume', volume
  )), '[]'::jsonb) INTO v_top FROM vol;

  -- Active plan summary
  WITH ap AS (
    SELECT id, name FROM workout_plans
     WHERE user_id = v_user_id AND is_active = true
     ORDER BY updated_at DESC LIMIT 1
  ),
  ds AS (
    SELECT pd.day_number, pd.name AS day_name,
           (SELECT count(*) FROM plan_day_exercises pde WHERE pde.day_id = pd.id) AS exercise_count
      FROM plan_days pd
     WHERE pd.plan_id = (SELECT id FROM ap)
     ORDER BY pd.day_number
  )
  SELECT CASE
    WHEN (SELECT id FROM ap) IS NULL THEN NULL
    ELSE jsonb_build_object(
      'name', (SELECT name FROM ap),
      'days', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'day_number', day_number, 'name', day_name, 'exercise_count', exercise_count
      )) FROM ds), '[]'::jsonb)
    )
  END INTO v_active_plan;

  RETURN jsonb_build_object(
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'unit_pref', v_profile.unit_pref,
    'member_since', v_member_since,
    'total_workouts', v_total,
    'streak', v_streak,
    'prs', v_prs,
    'top_exercises', v_top,
    'active_plan', v_active_plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_stats(text) TO anon, authenticated;

-- Public RPC: plan share by slug (returns name, description, sharer, snapshot, dates)
CREATE OR REPLACE FUNCTION public.get_public_plan_share(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'slug', slug,
    'plan_name', plan_name,
    'plan_description', plan_description,
    'shared_by_name', shared_by_name,
    'snapshot', snapshot,
    'created_at', created_at,
    'revoked', revoked_at IS NOT NULL
  )
  FROM plan_shares
  WHERE slug = _slug;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_plan_share(text) TO anon, authenticated;
