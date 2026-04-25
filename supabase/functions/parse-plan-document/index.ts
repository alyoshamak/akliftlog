// Deno edge function: parse a workout plan document into structured days/exercises.
// Accepts a path in the `plan-uploads` bucket and returns { days: [{ name, exercises: [{ name, sets, reps }] }] }.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { path, mime, name } = await req.json();
    if (!path) throw new Error("path required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: file, error: dlErr } = await admin.storage.from("plan-uploads").download(path);
    if (dlErr || !file) throw new Error("Could not read file: " + dlErr?.message);

    const isImage = (mime ?? "").startsWith("image/");
    const isText = (mime ?? "").startsWith("text/") || /\.(txt|md|csv)$/i.test(name ?? "");
    const isPdf = (mime === "application/pdf") || /\.pdf$/i.test(name ?? "");

    const messages: any[] = [
      {
        role: "system",
        content:
          "You extract weightlifting workout plans from documents. Return structured JSON only. " +
          "Each day has a list of exercises with name, target sets (int), target reps (int). " +
          "If sets/reps unclear, default to 3 sets of 10 reps. Normalize exercise names to common form.",
      },
    ];

    if (isImage) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const b64 = btoa(String.fromCharCode(...buf));
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract the workout plan from this image." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      });
    } else if (isText || isPdf) {
      // For simplicity: send raw text. PDFs parse poorly without a lib — fall back to text decode (works for text-based PDFs / fails gracefully).
      const text = await file.text();
      const truncated = text.slice(0, 20000);
      messages.push({
        role: "user",
        content: `Extract the workout plan from this document. File name: ${name}\n\n${truncated}`,
      });
    } else {
      // spreadsheets etc: try text decode
      const text = await file.text();
      messages.push({ role: "user", content: `Extract the workout plan. File name: ${name}\n\n${text.slice(0, 20000)}` });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "save_plan",
            description: "Save the parsed workout plan",
            parameters: {
              type: "object",
              properties: {
                days: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Day label, e.g. Push Day or Day 1" },
                      exercises: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            sets: { type: "integer", minimum: 1, maximum: 10 },
                            reps: { type: "integer", minimum: 1, maximum: 50 },
                          },
                          required: ["name", "sets", "reps"],
                        },
                      },
                    },
                    required: ["name", "exercises"],
                  },
                },
              },
              required: ["days"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit hit, try again in a minute." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error ${aiResp.status}: ${t}`);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured plan");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-plan error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
