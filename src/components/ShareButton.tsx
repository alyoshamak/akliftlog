import { useState } from "react";
import { Share2, RefreshCw, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  createOrReplacePlanShare, planShareUrl, copyToClipboardAsync, revokeShare,
} from "@/lib/share";

type Props = {
  planId: string;
  planName: string;
  planDescription: string | null;
  variant?: "icon" | "button";
  className?: string;
};

export default function ShareButton({ planId, planName, planDescription, variant = "icon", className }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const findExisting = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("plan_shares")
      .select("id, slug")
      .eq("user_id", user.id)
      .eq("source_plan_id", planId)
      .is("revoked_at", null)
      .maybeSingle();
    return (data as any) ?? null;
  };

  const getName = async () => {
    if (!user) return "Someone";
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    return (data as any)?.display_name || (data as any)?.username || "Someone";
  };

  const doShare = async (regenerate: boolean) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { ok, text } = await copyToClipboardAsync(async () => {
        const existing = !regenerate ? await findExisting() : null;
        let slug: string;
        if (existing) {
          slug = existing.slug;
        } else {
          const sharedBy = await getName();
          const res = await createOrReplacePlanShare(
            user.id, planId, planName, planDescription, sharedBy,
          );
          slug = res.slug;
        }
        return planShareUrl(slug);
      });
      toast.success(ok ? "Plan link copied!" : "Plan link ready", { description: text });
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate link");
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const existing = await findExisting();
      if (existing) {
        await revokeShare("plan_shares", existing.id);
        toast.success("Sharing stopped");
      } else {
        toast.message("No active share link");
      }
    } finally {
      setBusy(false);
    }
  };

  const trigger =
    variant === "icon" ? (
      <button
        aria-label="Share plan"
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-accent tap-44 ${className ?? ""}`}
        disabled={busy}
      >
        <Share2 className="h-4 w-4" />
      </button>
    ) : (
      <Button variant="secondary" className={`tap-44 font-bold text-xs ${className ?? ""}`} disabled={busy}>
        <Share2 className="h-3.5 w-3.5 mr-1" /> Share
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => doShare(false)}>
          <Copy className="h-4 w-4 mr-2" /> Copy share link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => doShare(true)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Update link to current
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doRevoke} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Stop sharing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
