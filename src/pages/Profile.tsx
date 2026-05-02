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
import { supabase } from "@/integrations/supabase/client";
import {
  copyToClipboard, copyToClipboardAsync, getOrCreateProfileShare, planShareUrl, profileShareUrl, revokeShare,
} from "@/lib/share";
import { Share2, Copy, Trash2, Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";

type PlanShareRow = {
  id: string;
  slug: string;
  plan_name: string;
  created_at: string;
  revoked_at: string | null;
};

type ProfileShareRow = {
  id: string;
  slug: string;
  revoked_at: string | null;
};

export default function Profile() {
  const { profile, update } = useProfile();
  const { signOut, user } = useAuth();
  const [name, setName] = useState("");
  const selectedTheme = getStoredTheme() ?? profile?.theme;

  const [profileShare, setProfileShare] = useState<ProfileShareRow | null>(null);
  const [planShares, setPlanShares] = useState<PlanShareRow[]>([]);
  const [linksOpen, setLinksOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (profile) setName(profile.display_name ?? ""); }, [profile]);
  useEffect(() => { if (selectedTheme) applyTheme(selectedTheme, { persist: false }); }, [selectedTheme]);

  const loadShares = async () => {
    if (!user) return;
    const [{ data: ps }, { data: pls }] = await Promise.all([
      supabase.from("profile_shares").select("id, slug, revoked_at").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("plan_shares")
        .select("id, slug, plan_name, created_at, revoked_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setProfileShare((ps as any) ?? null);
    setPlanShares((pls as any[]) ?? []);
  };

  useEffect(() => { loadShares(); }, [user]);

  if (!profile) return <AppShell><div className="pt-20 text-center text-muted-foreground">Loading…</div></AppShell>;

  const setGoal = (g: any) => update({ goal: g });
  const setUnit = (u: any) => update({ unit_pref: u });
  const setTheme = (t: any) => {
    update({ theme: t });
    applyTheme(t);
  };

  const shareProfile = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      // Use the iOS-friendly path: hand the clipboard a Promise so the
      // user-gesture context is preserved across the network request.
      const { ok, text } = await copyToClipboardAsync(async () => {
        const { slug } = await getOrCreateProfileShare(user.id);
        return profileShareUrl(slug);
      });
      toast.success(ok ? "Link copied!" : "Profile link ready", { description: text });
      loadShares();
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate link");
    } finally {
      setBusy(false);
    }
  };

  const stopProfileShare = async () => {
    if (!profileShare) return;
    await revokeShare("profile_shares", profileShare.id);
    toast.success("Profile sharing stopped");
    loadShares();
  };

  const stopPlanShare = async (id: string) => {
    await revokeShare("plan_shares", id);
    toast.success("Sharing stopped");
    loadShares();
  };

  const totalShares = (profileShare && !profileShare.revoked_at ? 1 : 0) + planShares.length;

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

        <Button
          onClick={shareProfile}
          disabled={busy}
          className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
        >
          <Share2 className="h-4 w-4 mr-1" /> Share Profile
        </Button>

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

        <div>
          <button
            onClick={() => setLinksOpen(!linksOpen)}
            className="flex w-full items-center justify-between py-2 text-left tap-44"
          >
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <LinkIcon className="h-3.5 w-3.5" /> Shared Links · {totalShares}
            </div>
            {linksOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {linksOpen && (
            <div className="space-y-2">
              {profileShare && !profileShare.revoked_at && (
                <ShareRow
                  title="Public profile"
                  url={profileShareUrl(profileShare.slug)}
                  onRevoke={stopProfileShare}
                />
              )}
              {planShares.map((p) => (
                <ShareRow
                  key={p.id}
                  title={p.plan_name}
                  subtitle={`Shared ${new Date(p.created_at).toLocaleDateString()}`}
                  url={planShareUrl(p.slug)}
                  onRevoke={() => stopPlanShare(p.id)}
                />
              ))}
              {totalShares === 0 && (
                <p className="text-xs text-muted-foreground py-2">No active share links.</p>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={async () => { await signOut(); }}
          variant="outline"
          className="w-full tap-56"
        >Sign out</Button>
      </div>
    </AppShell>
  );
}

function ShareRow({ title, subtitle, url, onRevoke }: { title: string; subtitle?: string; url: string; onRevoke: () => void }) {
  const copy = async () => {
    const ok = await copyToClipboard(url);
    toast.success(ok ? "Link copied!" : "Link ready", { description: url });
  };
  return (
    <div className="surface-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{subtitle ?? url}</div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={copy}
            aria-label="Copy"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-accent tap-44"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={onRevoke}
            aria-label="Stop sharing"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive tap-44"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
