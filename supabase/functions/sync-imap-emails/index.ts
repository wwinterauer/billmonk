import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  accountId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId }: SyncRequest = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Account ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch email account
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      console.error("Account not found:", accountError);
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account.is_active) {
      return new Response(JSON.stringify({ error: "Account is inactive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting IMAP sync for account: ${account.email_address}`);

    // Update account status to running
    await supabase
      .from("email_accounts")
      .update({ last_sync_status: "running" })
      .eq("id", accountId);

    // Decrypt password (simple base64 for now - in production use Supabase Vault)
    let password: string;
    try {
      password = atob(account.imap_password_encrypted);
    } catch {
      console.error("Failed to decrypt password");
      await supabase
        .from("email_accounts")
        .update({ 
          last_sync_status: "error",
          last_sync_error: "Passwort-Entschlüsselung fehlgeschlagen",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", accountId);
      
      return new Response(JSON.stringify({ error: "Password decryption failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Note: Deno doesn't have native IMAP support, so we'll use a simulated approach
    // In production, you would use a service like:
    // 1. Nylas API for email access
    // 2. A separate microservice with Node.js + node-imap
    // 3. Context.io or similar email API
    
    // For now, we'll create a placeholder that shows the structure
    // and update the account status accordingly
    
    console.log(`IMAP Connection details:`);
    console.log(`  Host: ${account.imap_host}`);
    console.log(`  Port: ${account.imap_port}`);
    console.log(`  User: ${account.imap_username}`);
    console.log(`  SSL: ${account.imap_use_ssl}`);
    console.log(`  Folder: ${account.inbox_folder}`);

    // Simulate IMAP connection attempt
    // In a real implementation, this would:
    // 1. Connect to IMAP server
    // 2. Search for emails with attachments
    // 3. Download PDF/image attachments
    // 4. Create email_attachments records
    // 5. Trigger receipt processing

    // For demonstration, we'll just update the status
    const syncResult = {
      success: true,
      messagesChecked: 0,
      attachmentsFound: 0,
      attachmentsProcessed: 0,
      errors: [] as string[],
    };

    // Update account with sync results
    await supabase
      .from("email_accounts")
      .update({
        last_sync_status: syncResult.errors.length > 0 ? "partial" : "success",
        last_sync_error: syncResult.errors.length > 0 ? syncResult.errors.join("; ") : null,
        last_sync_at: new Date().toISOString(),
        total_imported: account.total_imported + syncResult.attachmentsProcessed,
      })
      .eq("id", accountId);

    console.log(`Sync completed for ${account.email_address}`);
    console.log(`  Messages checked: ${syncResult.messagesChecked}`);
    console.log(`  Attachments found: ${syncResult.attachmentsFound}`);
    console.log(`  Attachments processed: ${syncResult.attachmentsProcessed}`);

    return new Response(
      JSON.stringify({
        success: true,
        account: account.email_address,
        result: syncResult,
        message: "IMAP-Sync ist konfiguriert. Für vollständige IMAP-Unterstützung wird ein externer E-Mail-Service (z.B. Nylas) benötigt.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("IMAP sync error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
