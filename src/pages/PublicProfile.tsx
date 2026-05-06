import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Flame, Trophy, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";

type Stats = {
  display_name: string | null;
  username: string | null;
  unit_pref: string;
  member_since: string;
  total_workouts: number;
  streak: number;
  prs: { exercise: string; weight: number; reps: number; unit: string; date: string }[];
  top_exercises: { name: string; muscle_group: string; volume: number }[];
  active_plan: { name: string; days: { day_number: number; name: string | null; exercise_count: number }[] } | null;
};

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_profile_stats", { _slug: slug });
      setStats((data as any) ?? null);
      setLoading(false);
      if (data) {
        const name = (data as any).display_name || (data as any).username || "LiftLog user";
        document.title = `${name} on LiftLog`;
      }
    })();
  }, [slug]);

  if (loading) {
    return <Centered><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></Centered>;
  }
  if (!stats) {
    return (
      <Centered>
        <div className="text-center px-6">
          <p className="text-2xl font-extrabold">Profile not found</p>
          <p className="mt-2 text-sm text-muted-foreground">This link may be private or no longer available.</p>
          <Link to="/" className="mt-6 inline-block text-accent underline">Go to LiftLog</Link>
        </div>
      </Centered>
    );
  }

  const initials = (stats.display_name || stats.username || "?")
    .split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto min-h-full max-w-md bg-background px-4 pt-safe pb-safe">
      <header className="pt-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Dumbbell className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold tracking-tight">LiftLog</span>
      </header>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground text-xl font-extrabold">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{stats.display_name ?? "LiftLog Lifter"}</h1>
          <p className="text-xs text-muted-foreground">
            Lifting since {format(new Date(stats.member_since), "MMM yyyy")}
          </p>
        </div>
      </div>

      {!signedIn && (
        <Link
          to="/auth?mode=signup"
          className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/15"
        >
          Sign up to LiftLog for free →
        </Link>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat icon={<Flame className="h-3.5 w-3.5 text-accent" />} label="Streak" value={stats.streak} unit={stats.streak === 1 ? "day" : "days"} />
        <Stat icon={<Calendar className="h-3.5 w-3.5 text-accent" />} label="Total" value={stats.total_workouts} unit="workouts" />
      </div>

      {stats.prs.length > 0 && (
        <Section title="Personal Records" icon={<Trophy className="h-3.5 w-3.5 text-accent" />}>
          <div className="surface-card divide-y divide-border">
            {stats.prs.map((pr) => (
              <div key={pr.exercise} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{pr.exercise}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(pr.date), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num font-extrabold text-lg leading-none">
                    {pr.weight}<span className="text-xs text-muted-foreground ml-1">{pr.unit}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">× {pr.reps}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {stats.top_exercises.length > 0 && (
        <Section title="Top exercises · last 30 days" icon={<TrendingUp className="h-3.5 w-3.5 text-accent" />}>
          <div className="surface-card divide-y divide-border">
            {stats.top_exercises.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{t.muscle_group}</div>
                </div>
                <div className="num text-xs text-muted-foreground">
                  {Math.round(Number(t.volume)).toLocaleString()} {stats.unit_pref}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {stats.active_plan && (
        <Section title="Current plan">
          <div className="surface-card p-4">
            <div className="font-bold">{stats.active_plan.name}</div>
            <div className="text-xs text-muted-foreground">
              {stats.active_plan.days.length} {stats.active_plan.days.length === 1 ? "day" : "days"} / week
            </div>
            <div className="mt-3 space-y-1.5">
              {stats.active_plan.days.map((d) => (
                <div key={d.day_number} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="text-muted-foreground mr-2">Day {d.day_number}</span>
                    {d.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {d.exercise_count} ex
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {!signedIn && (
        <div className="mt-8 rounded-2xl bg-accent text-accent-foreground p-5 accent-glow text-center">
          <p className="font-extrabold">Track your own lifts and PRs</p>
          <p className="mt-1 text-sm opacity-80">Free to start. Built for lifters.</p>
          <Link
            to="/auth"
            className="mt-3 inline-block rounded-xl bg-foreground text-background px-5 py-2.5 font-bold text-sm tap-44"
          >
            Sign up for LiftLog
          </Link>
        </div>
      )}

      <footer className="mt-8 text-center text-[11px] text-muted-foreground">
        <Link to="/" className="hover:underline">liftlog</Link>
      </footer>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-md items-center justify-center bg-background">{children}</div>;
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number; unit: string }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 text-3xl font-extrabold num">
        {value}<span className="text-sm text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
