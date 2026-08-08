import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_USER_ID = "bb51fc98-ee95-415b-afa6-31eedcbb624b";
const STARTED_AT = "2026-08-08T15:45:00.000Z";
const ENDED_AT = "2026-08-08T16:30:00.000Z";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7));
    if (authError || authData.user?.id !== TARGET_USER_ID) throw new Error("Unauthorized");

    const { data: receipts, error: readError } = await admin
      .from("receipts")
      .select("id,file_url")
      .eq("user_id", TARGET_USER_ID)
      .gte("created_at", STARTED_AT)
      .lt("created_at", ENDED_AT);
    if (readError) throw readError;

    const paths = [...new Set((receipts ?? []).map((row) => row.file_url).filter((path): path is string => Boolean(path)))];
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from("receipts").remove(paths.slice(index, index + 100));
      if (error) throw error;
    }

    const ids = (receipts ?? []).map((row) => row.id);
    for (let index = 0; index < ids.length; index += 100) {
      const { error } = await admin.from("receipts").delete().in("id", ids.slice(index, index + 100));
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, deletedReceipts: ids.length, deletedFiles: paths.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});