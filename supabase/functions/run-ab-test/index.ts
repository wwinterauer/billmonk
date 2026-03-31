import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;

// ── Structured Output Schema (V2) ──────────────────────────────────
const extractionSchema = {
  type: "object" as const,
  properties: {
    is_financial_document: { type: "boolean" as const },
    document_type: { type: "string" as const },
    reason: { type: "string" as const },
    vendor_name: { type: "string" as const },
    vendor_brand: { type: "string" as const },
    vendor_address: { type: "string" as const },
    vendor_uid: { type: "string" as const },
    vendor_legal_form: { type: "string" as const },
    vendor_country: { type: "string" as const },
    receipt_date: { type: "string" as const },
    due_date: { type: "string" as const },
    receipt_number: { type: "string" as const },
    total_amount: { type: "number" as const },
    net_amount: { type: "number" as const },
    tax_amount: { type: "number" as const },
    tax_rate: { type: "string" as const },
    is_mixed_tax_rate: { type: "boolean" as const },
    tax_rate_details: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          rate: { type: "number" as const },
          net_amount: { type: "number" as const },
          tax_amount: { type: "number" as const },
          description: { type: "string" as const },
        },
        required: ["rate", "net_amount", "tax_amount", "description"],
        additionalProperties: false,
      },
    },
    currency: { type: "string" as const },
    payment_method: { type: "string" as const },
    category: { type: "string" as const },
    description: { type: "string" as const },
    line_items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          description: { type: "string" as const },
          quantity: { type: "number" as const },
          unit_price: { type: "number" as const },
          total: { type: "number" as const },
          tax_rate: { type: "string" as const },
          category: { type: "string" as const },
        },
        required: ["description", "quantity", "unit_price", "total", "tax_rate", "category"],
        additionalProperties: false,
      },
    },
    confidence: { type: "number" as const },
    vat_confidence: { type: "number" as const },
    vat_detection_method: { type: "string" as const },
    special_vat_case: { type: "string" as const },
    notes: { type: "string" as const },
  },
  required: [
    "is_financial_document", "document_type", "vendor_name", "total_amount",
    "tax_rate", "currency", "category", "confidence",
    "reason", "vendor_brand", "vendor_address", "vendor_uid",
    "vendor_legal_form", "vendor_country", "receipt_date", "due_date",
    "receipt_number", "net_amount", "tax_amount", "is_mixed_tax_rate",
    "tax_rate_details", "payment_method", "description", "line_items",
    "vat_confidence", "vat_detection_method", "special_vat_case", "notes",
  ],
  additionalProperties: false,
};

const COMPARISON_FIELDS = [
  "vendor_name", "total_amount", "tax_rate", "tax_amount", "category", "receipt_date",
];

// ── Vendor-Kontext: Expenses-Only Prompt Builder ──────────────────
function buildExpensesOnlyPrompt(keywords: string[] | null, hint: string | null): string {
  let block = "";
  if (keywords && keywords.length > 0) {
    block += `\n\nWICHTIG – NUR AUSGABEN EXTRAHIEREN:
Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten.
Extrahiere AUSSCHLIESSLICH die Positionen, die eines dieser Schlagwörter enthalten: ${keywords.join(", ")}
Ignoriere alle anderen Zeilen (Einnahmen, Gutschriften, Auszahlungen).
Beträge in Klammern sind Kosten und sollen als positive Werte erfasst werden.
Ignoriere Zwischen- und Gesamtsummen — nur einzelne Kostenzeilen zählen.
Summiere alle gefundenen Kosten-Positionen zum Gesamtbetrag.`;
  }
  if (hint && hint.trim()) {
    block += `\n\nLIEFERANTEN-HINWEIS: ${hint.trim()}`;
  }
  return block;
}

function compareField(fieldName: string, original: any, extracted: any): boolean {
  if (original == null || original === "" || original === "unknown") return true;
  if (extracted == null || extracted === "") return false;

  const origStr = String(original).toLowerCase().trim();
  const extStr = String(extracted).toLowerCase().trim();

  switch (fieldName) {
    case "vendor_name":
      return origStr.includes(extStr) || extStr.includes(origStr) ||
        origStr.replace(/\s+(gmbh|ag|kg|e\.u\.|ug|ltd|llc|ohg|og)\.?$/i, '').trim() ===
        extStr.replace(/\s+(gmbh|ag|kg|e\.u\.|ug|ltd|llc|ohg|og)\.?$/i, '').trim();

    case "total_amount":
    case "tax_amount": {
      const origNum = parseFloat(origStr);
      const extNum = parseFloat(extStr);
      if (isNaN(origNum) || isNaN(extNum)) return false;
      return Math.abs(origNum - extNum) <= 0.05;
    }

    case "tax_rate": {
      if (origStr === "mixed" && extStr === "mixed") return true;
      const origRate = parseFloat(origStr);
      const extRate = parseFloat(extStr);
      if (isNaN(origRate) || isNaN(extRate)) return origStr === extStr;
      return Math.abs(origRate - extRate) < 0.1;
    }

    case "receipt_date":
      return origStr === extStr;

    default:
      return origStr === extStr;
  }
}

function parseAiResponse(content: string): Record<string, any> | null {
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function mapFieldName(field: string, isV2: boolean): string {
  if (isV2) {
    switch (field) {
      case "vendor_name": return "vendor_name";
      case "total_amount": return "total_amount";
      case "tax_rate": return "tax_rate";
      case "tax_amount": return "tax_amount";
      default: return field;
    }
  } else {
    switch (field) {
      case "vendor_name": return "vendor";
      case "total_amount": return "amount_gross";
      case "tax_rate": return "vat_rate";
      case "tax_amount": return "vat_amount";
      default: return field;
    }
  }
}

async function processBatch(
  supabase: any,
  lovableApiKey: string,
  testRunId: string,
  v1Prompt: any,
  v2Prompt: any,
  items: any[],
) {
  for (const item of items) {
    try {
      const { data: receipt } = await supabase
        .from("receipts").select("file_url, file_type, file_name, user_id, vendor_id").eq("id", item.receipt_id).single();
      if (!receipt?.file_url) {
        console.error(`No file_url for receipt ${item.receipt_id}`);
        continue;
      }

      const { data: fileData } = await supabase.storage.from("receipts").download(receipt.file_url);
      if (!fileData) {
        console.error(`Download failed for ${receipt.file_url}`);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const imageBase64 = btoa(binaryString);
      const isPdf = receipt.file_name?.endsWith(".pdf") || receipt.file_type === "pdf" || receipt.file_type === "application/pdf";
      const mimeType = isPdf ? "application/pdf" : `image/${receipt.file_type || "jpeg"}`;

      let categoryList = "Sonstiges";
      if (receipt.user_id) {
        const { data: cats } = await supabase
          .from("categories").select("name").eq("is_hidden", false)
          .or(`user_id.eq.${receipt.user_id},is_system.eq.true`);
        if (cats && cats.length > 0) {
          categoryList = cats.map((c: any) => c.name).filter((n: string) => n !== "Keine Rechnung").join(", ");
        }
      }

      // ── Load vendor context ──────────────────────────────────
      let vendorContextPrompt = "";
      if (receipt.vendor_id) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("expenses_only_extraction, extraction_keywords, extraction_hint")
          .eq("id", receipt.vendor_id)
          .single();
        if (vendor?.expenses_only_extraction) {
          vendorContextPrompt = buildExpensesOnlyPrompt(vendor.extraction_keywords, vendor.extraction_hint);
        } else if (vendor?.extraction_hint) {
          vendorContextPrompt = `\n\nLIEFERANTEN-HINWEIS: ${vendor.extraction_hint.trim()}`;
        }
      }

      // ── V1 Call ─────────────────────────────────────────────
      const v1UserPrompt = v1Prompt.user_prompt_template.replace("{{categories}}", categoryList) + vendorContextPrompt;
      const v1Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: v1Prompt.system_prompt },
            { role: "user", content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: v1UserPrompt },
            ]},
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      let resultA: Record<string, any> | null = null;
      if (v1Response.ok) {
        const v1Json = await v1Response.json();
        const v1Content = v1Json.choices?.[0]?.message?.content;
        if (v1Content) resultA = parseAiResponse(v1Content);
      } else {
        console.error(`V1 failed for ${item.id}: ${v1Response.status}`);
        await v1Response.text();
      }

      // ── V2 Call ─────────────────────────────────────────────
      const v2UserPrompt = v2Prompt.user_prompt_template.replace("{{categories}}", categoryList) + vendorContextPrompt;
      const v2Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: v2Prompt.system_prompt },
            { role: "user", content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: v2UserPrompt },
            ]},
          ],
          max_tokens: 2048,
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: { name: "receipt_extraction", strict: true, schema: extractionSchema },
          },
        }),
      });

      let resultB: Record<string, any> | null = null;
      if (v2Response.ok) {
        const v2Json = await v2Response.json();
        const v2Content = v2Json.choices?.[0]?.message?.content;
        if (v2Content) resultB = parseAiResponse(v2Content);
      } else {
        console.error(`V2 failed for ${item.id}: ${v2Response.status}`);
        await v2Response.text();
      }

      // ── Compare ─────────────────────────────────────────────
      const original = item.original_data as Record<string, any> || {};
      const scores: Record<string, { a: boolean | null; b: boolean | null }> = {};

      for (const field of COMPARISON_FIELDS) {
        const origVal = original[field];
        const hasGroundTruth = origVal != null && origVal !== "" && origVal !== "unknown";
        let aMatch: boolean | null = null;
        let bMatch: boolean | null = null;

        if (hasGroundTruth) {
          const aiFieldA = mapFieldName(field, false);
          const aiFieldB = mapFieldName(field, true);
          if (resultA) aMatch = compareField(field, origVal, resultA[aiFieldA]);
          if (resultB) bMatch = compareField(field, origVal, resultB[aiFieldB]);
        }
        scores[field] = { a: aMatch, b: bMatch };
      }

      await supabase.from("ab_test_items").update({
        result_a: resultA,
        result_b: resultB,
        field_scores: scores,
      }).eq("id", item.id);

      console.log(`Processed item ${item.id}`);
    } catch (err) {
      console.error(`Error processing item ${item.id}:`, err);
    }
  }
}

async function finalize(supabase: any, testRunId: string) {
  // Load all items to compute accuracy
  const { data: allItems } = await supabase
    .from("ab_test_items")
    .select("field_scores, result_a, result_b")
    .eq("test_run_id", testRunId);

  if (!allItems) return;

  const fieldAccuracy: Record<string, { a_correct: number; a_total: number; b_correct: number; b_total: number }> = {};
  COMPARISON_FIELDS.forEach(f => { fieldAccuracy[f] = { a_correct: 0, a_total: 0, b_correct: 0, b_total: 0 }; });

  let processed = 0;
  let errors = 0;

  for (const item of allItems) {
    if (!item.result_a && !item.result_b) { errors++; continue; }
    processed++;
    const scores = item.field_scores as Record<string, { a: boolean | null; b: boolean | null }> || {};
    for (const field of COMPARISON_FIELDS) {
      const s = scores[field];
      if (!s) continue;
      if (s.a !== null) {
        fieldAccuracy[field].a_total++;
        if (s.a) fieldAccuracy[field].a_correct++;
      }
      if (s.b !== null) {
        fieldAccuracy[field].b_total++;
        if (s.b) fieldAccuracy[field].b_correct++;
      }
    }
  }

  // Delete old accuracy rows, insert new
  await supabase.from("ab_test_field_accuracy").delete().eq("test_run_id", testRunId);
  const accuracyRows = COMPARISON_FIELDS.map(field => ({
    test_run_id: testRunId,
    field_name: field,
    version_a_correct: fieldAccuracy[field].a_correct,
    version_a_total: fieldAccuracy[field].a_total,
    version_b_correct: fieldAccuracy[field].b_correct,
    version_b_total: fieldAccuracy[field].b_total,
  }));
  await supabase.from("ab_test_field_accuracy").insert(accuracyRows);

  let totalACorrect = 0, totalATotal = 0, totalBCorrect = 0, totalBTotal = 0;
  for (const f of COMPARISON_FIELDS) {
    totalACorrect += fieldAccuracy[f].a_correct;
    totalATotal += fieldAccuracy[f].a_total;
    totalBCorrect += fieldAccuracy[f].b_correct;
    totalBTotal += fieldAccuracy[f].b_total;
  }

  const summary = {
    total_items: allItems.length,
    processed,
    errors,
    overall_accuracy_a: totalATotal > 0 ? Math.round((totalACorrect / totalATotal) * 10000) / 100 : 0,
    overall_accuracy_b: totalBTotal > 0 ? Math.round((totalBCorrect / totalBTotal) * 10000) / 100 : 0,
    field_accuracy: Object.fromEntries(
      COMPARISON_FIELDS.map(f => [f, {
        a: fieldAccuracy[f].a_total > 0 ? Math.round((fieldAccuracy[f].a_correct / fieldAccuracy[f].a_total) * 10000) / 100 : null,
        b: fieldAccuracy[f].b_total > 0 ? Math.round((fieldAccuracy[f].b_correct / fieldAccuracy[f].b_total) * 10000) / 100 : null,
      }])
    ),
  };

  await supabase.from("ab_test_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    results_summary: summary,
  }).eq("id", testRunId);

  console.log(`A/B test finalized. A: ${summary.overall_accuracy_a}%, B: ${summary.overall_accuracy_b}%`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { test_run_id, batch_offset } = await req.json();
    if (!test_run_id) {
      return new Response(JSON.stringify({ error: "test_run_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offset = batch_offset || 0;
    const isFirstCall = offset === 0;

    if (isFirstCall) {
      await supabase.from("ab_test_runs").update({ status: "running" }).eq("id", test_run_id);
    }

    // Load prompt versions
    const { data: testRun } = await supabase
      .from("ab_test_runs").select("prompt_version_a, prompt_version_b").eq("id", test_run_id).single();
    if (!testRun) throw new Error("Test run not found");

    const { data: v1Prompt } = await supabase
      .from("prompt_versions").select("*").eq("version", testRun.prompt_version_a).single();
    const { data: v2Prompt } = await supabase
      .from("prompt_versions").select("*").eq("version", testRun.prompt_version_b).single();
    if (!v1Prompt || !v2Prompt) throw new Error("Prompt versions not found");

    // Check if test was stopped before processing
    const { data: currentRun } = await supabase
      .from("ab_test_runs").select("status").eq("id", test_run_id).single();
    if (currentRun?.status === "stopped") {
      console.log("Test was stopped, aborting batch.");
      return new Response(JSON.stringify({ success: true, message: "Test gestoppt", stopped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load batch of unprocessed items
    const { data: items } = await supabase
      .from("ab_test_items")
      .select("id, receipt_id, original_data")
      .eq("test_run_id", test_run_id)
      .is("result_a", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!items || items.length === 0) {
      // No more items — finalize
      console.log("No more items, finalizing...");
      await finalize(supabase, test_run_id);
      return new Response(JSON.stringify({ success: true, message: "Test abgeschlossen", done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing batch at offset ${offset}: ${items.length} items`);

    // Process this batch
    await processBatch(supabase, lovableApiKey, test_run_id, v1Prompt, v2Prompt, items);

    // Fire-and-forget: trigger next batch
    const nextOffset = offset + items.length;
    console.log(`Triggering next batch at offset ${nextOffset}`);

    fetch(`${supabaseUrl}/functions/v1/run-ab-test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test_run_id, batch_offset: nextOffset }),
    }).catch(err => {
      console.error("Failed to trigger next batch:", err);
    });

    if (isFirstCall) {
      return new Response(JSON.stringify({ success: true, message: "Test gestartet — Verarbeitung läuft im Hintergrund" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, batch_offset: nextOffset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("A/B test error:", err);

    // Try to set error status
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.clone().json().catch(() => ({}));
      if (body.test_run_id) {
        await supabase.from("ab_test_runs").update({ status: "error" }).eq("id", body.test_run_id);
      }
    } catch {}

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
