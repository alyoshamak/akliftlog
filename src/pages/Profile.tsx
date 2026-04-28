import AppShell from "@/components/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import BodyWeightLog from "@/components/BodyWeightLog";
import { applyTheme, getStoredTheme } from "@/lib/theme";

export default function Profile() {
  const { profile, update } = useProfile();
  const { signOut, user } = useAuth();
  const [name, setName] = useState("");
  const selectedTheme = getStoredTheme() ?? profile?.theme;

  useEffect(() => { if (profile) setName(profile.display_name ?? ""); }, [profile]);
  useEffect(() => { if (selectedTheme) applyTheme(selectedTheme, { persist: false }); }, [selectedTheme]);

  if (!profile) return <AppShell><div className="pt-20 text-center text-muted-foreground">Loading…</div></AppShell>;

  const setGoal = (g: any) => update({ goal: g });
  const setUnit = (u: any) => update({ unit_pref: u });
  const setTheme = (t: any) => {
    update({ theme: t });
    applyTheme(t);
  };

  return (
    <AppShell>
      <div className="px-4 pt-safe space-y-6">
        <h1 className="pt-3 text-3xl font-extrabold tracking-tight">Profile</h1>

        <div className="surface-card p-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Display name</Label>
          <div className="mt-2 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="tap-44" />
            <Button
              onClick={async () => { await update({ display_name: name }); toast.success("Saved"); }}
              className="tap-44"
            >Save</Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{user?.email}</div>
        </div>

        <BodyWeightLog unit={profile.unit_pref} />

        <Section title="Goal">
          <Toggles options={[["hypertrophy","Hypertrophy"],["strength","Strength"],["endurance","Endurance"]]} value={profile.goal} onChange={setGoal} />
        </Section>

        <Section title="Units">
          <Toggles options={[["lb","Pounds"],["kg","Kilograms"]]} value={profile.unit_pref} onChange={setUnit} />
        </Section>

        <Section title="Theme">
          <Toggles
            options={[["dark","Dark"],["light","Light"],["system","Auto"],["wild","Wild"]]}
            value={selectedTheme ?? profile.theme}
            onChange={setTheme}
            cols={4}
          />
        </Section>

        <Button
          onClick={async () => { await signOut(); }}
          variant="outline"
          className="w-full tap-56"
        >Sign out</Button>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function Toggles({ options, value, onChange, cols = 3 }: { options: [string, string][]; value: string; onChange: (v: string) => void; cols?: 2 | 3 | 4 }) {
  const colClass = cols === 4 ? "grid-cols-4" : cols === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-2`}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`tap-56 rounded-xl px-3 py-3 text-sm font-bold ${value === v ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
