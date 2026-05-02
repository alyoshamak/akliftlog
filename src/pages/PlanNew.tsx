import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import PlanCreateOptions from "@/components/PlanCreateOptions";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function PlanNew() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const goManual = async () => {
    if (!user) return;
    setBusy(true);
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .insert({
        user_id: user.id,
        name: "New Plan",
        description: "Custom plan",
        source: "custom",
        is_active: false,
      })
      .select().maybeSingle();
    setBusy(false);
    if (error || !plan) {
      toast.error(error?.message ?? "Could not create plan");
      return;
    }
    nav(`/plan/edit?planId=${plan.id}&first=1&askActive=1`, { replace: true });
  };

  return (
    <AppShell hideNav>
      <div className="px-4 pt-safe pb-safe">
        <button
          onClick={() => nav("/plan")}
          className="flex items-center gap-1 text-sm text-muted-foreground tap-44 -ml-2 px-2 pt-3"
        >
          <ChevronLeft className="h-4 w-4" /> Plans
        </button>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Create a new plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick how you'd like to start.</p>

        <div className="mt-6">
          <PlanCreateOptions
            onTemplate={() => nav("/templates?from=hub")}
            onManual={goManual}
            onUpload={() => nav("/upload?from=hub")}
            disabled={busy}
          />
        </div>
      </div>
    </AppShell>
  );
}
