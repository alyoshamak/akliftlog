import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Entry = { id: string; weight: number; unit: string; recorded_at: string };

export default function BodyWeightLog({ unit }: { unit: "lb" | "kg" }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("body_weights")
      .select("id, weight, unit, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true });
    setEntries((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, [user]);

  const add = async () => {
    const w = parseFloat(value);
    if (!user || !w || w <= 0) return;
    setSaving(true);
    const { error } = await supabase.from("body_weights").insert({
      user_id: user.id,
      weight: w,
      unit,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save");
      return;
    }
    setValue("");
    toast.success("Logged");
    load();
  };

  const latest = entries[entries.length - 1];
  const chartData = entries.map((e) => ({
    date: format(new Date(e.recorded_at), "MMM d"),
    weight: Number(e.weight),
  }));

  return (
    <div className="surface-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Body weight
        </div>
        {latest && (
          <div className="text-xs text-muted-foreground">
            Last: {Number(latest.weight)} {latest.unit} ·{" "}
            {format(new Date(latest.recorded_at), "MMM d")}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={`Weight (${unit})`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="tap-44"
        />
        <Button onClick={add} disabled={saving || !value} className="tap-44">
          Log
        </Button>
      </div>

      {chartData.length > 1 ? (
        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                stroke="hsl(var(--border))"
                domain={["auto", "auto"]}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {chartData.length === 1
            ? "Log one more entry to see your trend."
            : "No entries yet — log your first weight above."}
        </div>
      )}
    </div>
  );
}
