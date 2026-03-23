import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Parallel queries for health + feature data
    const [
      errorReceipts,
      errorReceiptsCount,
      emailSyncErrors,
      totalReceipts,
      totalInvoices,
      activeBankConnections,
      activeEmailAccounts,
      activeCloudConnections,
      totalUsers,
      recentActivity,
    ] = await Promise.all([
      // Failed receipts (last 50)
      adminClient
        .from("receipts")
        .select("id, file_name, status, created_at, user_id")
        .eq("status", "error")
        .order("created_at", { ascending: false })
        .limit(50),
      // Failed receipts count
      adminClient
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "error"),
      // Email sync errors
      adminClient
        .from("email_accounts")
        .select("id, email_address, last_sync_status, last_sync_error, last_sync_attempt, user_id")
        .eq("last_sync_status", "error"),
      // Feature counts
      adminClient
        .from("receipts")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("invoices")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("bank_connections_live")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      adminClient
        .from("email_accounts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      adminClient
        .from("cloud_connections")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      // Recent activity
      adminClient
        .from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Get user emails for error receipts
    const errorUserIds = [...new Set((errorReceipts.data || []).map((r: any) => r.user_id))];
    let userEmailMap: Record<string, string> = {};
    if (errorUserIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email")
        .in("id", errorUserIds);
      for (const p of profiles || []) {
        userEmailMap[p.id] = p.email;
      }
    }

    const enrichedErrorReceipts = (errorReceipts.data || []).map((r: any) => ({
      ...r,
      user_email: userEmailMap[r.user_id] || "Unknown",
    }));

    return new Response(
      JSON.stringify({
        health: {
          error_receipts: enrichedErrorReceipts,
          error_receipts_count: errorReceiptsCount.count || 0,
          email_sync_errors: emailSyncErrors.data || [],
          email_sync_error_count: (emailSyncErrors.data || []).length,
        },
        features: {
          total_receipts: totalReceipts.count || 0,
          total_invoices: totalInvoices.count || 0,
          active_bank_connections: activeBankConnections.count || 0,
          active_email_accounts: activeEmailAccounts.count || 0,
          active_cloud_connections: activeCloudConnections.count || 0,
          total_users: totalUsers.count || 0,
        },
        activity: recentActivity.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
