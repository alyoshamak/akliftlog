CREATE OR REPLACE FUNCTION public.get_public_profile_stats(_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  WITH days AS (
    SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date AS d
      FROM workout_sessions
     WHERE user_id = v_user_id AND finished_at IS NOT NULL
  ),
  ordered AS (
    SELECT d, (ROW_NUMBER() OVER (ORDER BY d DESC) - 1)::int AS rn FROM days
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
     AND ordered.d = (start_anchor.s - (ordered.rn || ' days')::interval)::date;

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
$function$;