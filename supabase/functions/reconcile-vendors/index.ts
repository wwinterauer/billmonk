import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { matchVendor, hasLegalForm, normalizeVendorName } from "../_shared/vendorMatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: vendors } = await admin
      .from("vendors")
      .select("id, display_name, legal_names, auto_approve, auto_approve_min_confidence")
      .eq("user_id", user.id);

    const { data: receipts, error: receiptsError } = await admin
      .from("receipts")
      .select("id, vendor, vendor_brand, vendor_id, ai_confidence, is_duplicate, status")
      .eq("user_id", user.id)
      .eq("status", "review");

    if (receiptsError) return json({ error: receiptsError.message }, 500);

    let linked = 0;
    let approved = 0;

    for (const receipt of receipts ?? []) {
      let vendorId = receipt.vendor_id as string | null;
      let vendorRow = vendorId ? (vendors ?? []).find(v => v.id === vendorId) ?? null : null;

      if (!vendorId) {
        const match = matchVendor(vendors ?? [], receipt.vendor, receipt.vendor_brand);
        if (!match) continue;
        vendorId = match.id;
        vendorRow = match;

        // Auto-learn the legal name variant we just resolved.
        const aiName = (receipt.vendor || "").trim();
        if (aiName && hasLegalForm(aiName)) {
          const known = new Set<string>([
            (match.display_name || "").toLowerCase(),
            ...((match.legal_names || []) as string[]).map(n => n.toLowerCase()),
          ]);
          if (!known.has(aiName.toLowerCase()) && normalizeVendorName(aiName)) {
            await admin
              .from("vendors")
              .update({ legal_names: [...((match.legal_names || []) as string[]), aiName] })
              .eq("id", match.id);
          }
        }

        await admin.from("receipts").update({ vendor_id: vendorId }).eq("id", receipt.id);
        linked++;
      }

      // Auto-approve where the vendor allows it and confidence is high enough.
      if (
        vendorRow?.auto_approve &&
        !receipt.is_duplicate &&
        Number(receipt.ai_confidence ?? 0) >= Number(vendorRow.auto_approve_min_confidence ?? 0.8)
      ) {
        const { error: approveError } = await admin
          .from("receipts")
          .update({ status: "approved", auto_approved: true })
          .eq("id", receipt.id);
        if (!approveError) approved++;
      }
    }

    return json({ scanned: receipts?.length ?? 0, linked, approved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[reconcile-vendors] error:", message);
    return json({ error: message }, 500);
  }
});
