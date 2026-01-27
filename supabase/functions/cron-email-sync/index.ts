import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping von sync_interval zu Minuten
const INTERVAL_MINUTES: Record<string, number> = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1hour': 60,
  '6hours': 360,
  '12hours': 720,
  'daily': 1440,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Starting scheduled email sync check...");

    // Alle aktiven IMAP-Konten laden, die NICHT gerade synchronisieren
    const { data: accounts, error: fetchError } = await supabase
      .from("email_accounts")
      .select("id, email_address, sync_interval, last_sync_at, last_sync_status")
      .eq("is_active", true)
      .neq("sync_interval", "manual");

    if (fetchError) {
      throw new Error(`Fehler beim Laden der Accounts: ${fetchError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      console.log("Keine aktiven Accounts für Auto-Sync gefunden");
      return new Response(
        JSON.stringify({ success: true, message: "Keine Accounts zu synchronisieren", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out accounts that are currently syncing
    const availableAccounts = accounts.filter(
      acc => acc.last_sync_status !== 'running' && acc.last_sync_status !== 'syncing'
    );

    console.log(`Gefunden: ${accounts.length} aktive Accounts, ${availableAccounts.length} verfügbar für Sync`);

    const now = new Date();
    const syncResults: { accountId: string; email: string; status: string; error?: string }[] = [];

    for (const account of availableAccounts) {
      try {
        // Prüfen ob Sync fällig ist
        const intervalMinutes = INTERVAL_MINUTES[account.sync_interval] || 60;
        const lastSync = account.last_sync_at ? new Date(account.last_sync_at) : null;
        
        if (lastSync) {
          const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
          
          if (minutesSinceLastSync < intervalMinutes) {
            console.log(`${account.email_address}: Sync nicht fällig (${Math.round(minutesSinceLastSync)}/${intervalMinutes} min)`);
            syncResults.push({ 
              accountId: account.id, 
              email: account.email_address, 
              status: "skipped",
            });
            continue;
          }
        }

        console.log(`${account.email_address}: Starte Sync...`);

        // Sync-Funktion aufrufen
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          "sync-imap-emails",
          { body: { accountId: account.id } }
        );

        if (syncError) {
          throw syncError;
        }

        if (syncResult?.success) {
          console.log(`${account.email_address}: Sync erfolgreich - ${syncResult.imported || 0} importiert`);
          syncResults.push({ 
            accountId: account.id, 
            email: account.email_address, 
            status: "success",
          });
        } else {
          throw new Error(syncResult?.error || "Unbekannter Fehler");
        }

      } catch (accountError: any) {
        console.error(`${account.email_address}: Sync fehlgeschlagen - ${accountError.message}`);
        syncResults.push({ 
          accountId: account.id, 
          email: account.email_address, 
          status: "error",
          error: accountError.message,
        });
      }

      // Kleine Pause zwischen Accounts um Rate-Limits zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = syncResults.filter(r => r.status === "success").length;
    const errorCount = syncResults.filter(r => r.status === "error").length;
    const skippedCount = syncResults.filter(r => r.status === "skipped").length;

    console.log(`Sync abgeschlossen: ${successCount} erfolgreich, ${errorCount} Fehler, ${skippedCount} übersprungen`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync abgeschlossen: ${successCount} erfolgreich, ${errorCount} Fehler`,
        results: syncResults,
        summary: { success: successCount, error: errorCount, skipped: skippedCount },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Cron Email Sync Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
