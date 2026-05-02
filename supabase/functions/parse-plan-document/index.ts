// Deno edge function: parse a workout plan document into structured days/exercises.
// Supported inputs:
//   - Images (image/*): sent to vision model directly.
//   - CSV / TXT / MD: decoded as text.
//   - XLSX / XLS: parsed with the xlsx lib, each sheet converted to CSV.
//   - PDF: rendered to PNG pages via pdf-img-convert and sent as images (handles text + scanned).
// Returns: { days: [{ name, exercises: [{ name, sets: int|null, reps: int|null, confidence, notes?, superset_group? }] }], reason? }
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import pdfToImg from "https://esm.sh/pdf-img-convert@1.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

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
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { path, mime, name, goal } = await req.json();
    if (!path) throw new Error("path required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: file, error: dlErr } = await admin.storage.from("plan-uploads").download(path);
    if (dlErr || !file) throw new Error("Could not read file: " + dlErr?.message);

    const lowerName = (name ?? "").toLowerCase();
    const isImage = (mime ?? "").startsWith("image/");
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(lowerName);
    const isXlsx = /\.(xlsx|xls)$/i.test(lowerName) ||
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel";
    const isTextLike = (mime ?? "").startsWith("text/") || /\.(txt|md|csv)$/i.test(lowerName);

    const goalText = goal === "strength" ? "strength (low reps, high weight)"
      : goal === "endurance" ? "endurance (high reps)"
      : "hypertrophy (moderate reps)";

    const systemPrompt =
      "You extract weightlifting workout plans from documents. Return structured data via the save_plan tool. " +
      "STRICT RULES:\n" +
      "1. Extract ONLY exercises that are explicitly present in the document. Do NOT invent exercises.\n" +
      "2. If the document does NOT contain a workout plan (e.g. it's a recipe, contract, blank, or unreadable), return days: [].\n" +
      "3. If sets or reps are missing or unclear for an exercise, set the field to null. Do NOT guess.\n" +
      "4. For each exercise include a confidence: 'high' (clearly stated), 'medium' (inferred from context), or 'low' (uncertain).\n" +
      "5. Normalize exercise names (e.g. 'BB Bench' → 'Barbell Bench Press').\n" +
      "6. Group exercises by training day as they appear. Use the document's day names ('Push', 'Day 1', etc.) when present.\n" +
      `User's goal context (for tone only, not for filling missing values): ${goalText}.`;

    const userMessage: any = { role: "user", content: [] as any[] };

    if (isImage) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const b64 = bytesToB64(buf);
      userMessage.content.push({ type: "text", text: "Extract the workout plan from this image." });
      userMessage.content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
    } else if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      let pageImages: Uint8Array[] = [];
      try {
        const out = await pdfToImg(buf, { scale: 2 });
        pageImages = (out as any[]).slice(0, 6).map((p: any) =>
          p instanceof Uint8Array ? p : new Uint8Array(p)
        );
      } catch (e) {
        console.error("pdf render failed:", e);
      }
      if (pageImages.length === 0) {
        return new Response(JSON.stringify({ days: [], reason: "pdf_render_failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userMessage.content.push({
        type: "text",
        text: `Extract the workout plan from these ${pageImages.length} PDF page image(s). File: ${name}`,
      });
      for (const img of pageImages) {
        userMessage.content.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${bytesToB64(img)}` },
        });
      }
    } else if (isXlsx) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array" });
      const sheetTexts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (csv.trim()) sheetTexts.push(`### Sheet: ${sheetName}\n${csv}`);
      }
      const combined = sheetTexts.join("\n\n").slice(0, 30000);
      if (!combined.trim()) {
        return new Response(JSON.stringify({ days: [], reason: "empty_spreadsheet" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userMessage.content = `Extract the workout plan from this spreadsheet (each sheet may be a different day).\nFile: ${name}\n\n${combined}`;
    } else if (isTextLike) {
      const text = (await file.text()).slice(0, 30000);
      if (!text.trim()) {
        return new Response(JSON.stringify({ days: [], reason: "empty_file" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userMessage.content = `Extract the workout plan from this document.\nFile: ${name}\n\n${text}`;
    } else {
      // Unknown — try text decode and check for printable ratio
      const text = await file.text();
      const printable = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length;
      if (text.length === 0 || printable / text.length < 0.7) {
        return new Response(JSON.stringify({ days: [], reason: "unsupported_format" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userMessage.content = `Extract the workout plan from this document.\nFile: ${name}\n\n${text.slice(0, 30000)}`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, userMessage],
        tools: [{
          type: "function",
          function: {
            name: "save_plan",
            description: "Save the parsed workout plan. Return days: [] if no plan was found.",
            parameters: {
              type: "object",
              properties: {
                days: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Day label, e.g. 'Push Day' or 'Day 1'" },
                      exercises: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            sets: { type: ["integer", "null"], minimum: 1, maximum: 10 },
                            reps: { type: ["integer", "null"], minimum: 1, maximum: 50 },
                            confidence: { type: "string", enum: ["high", "medium", "low"] },
                            notes: { type: "string" },
                            superset_group: { type: ["integer", "null"] },
                          },
                          required: ["name", "sets", "reps", "confidence"],
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
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit, try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    console.log("AI raw message:", JSON.stringify(aiJson.choices?.[0]?.message ?? {}).slice(0, 2000));
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ days: [], reason: "no_structured_output" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    const days = Array.isArray(args.days) ? args.days : [];
    const payload: any = { days };
    if (days.length === 0) payload.reason = "no_plan_detected";

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-plan error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
