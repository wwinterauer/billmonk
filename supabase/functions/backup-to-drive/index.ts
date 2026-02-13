import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data;
}

async function uploadFileToDrive(accessToken: string, fileName: string, content: Uint8Array, mimeType: string, folderId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "backup_boundary_" + crypto.randomUUID();
  const metadataStr = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    content,
    encoder.encode(`\r\n--${boundary}--`),
  ];

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth prüfen
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht authentifiziert");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Ungültiger Token");

    const { connectionId } = await req.json();

    // Connection laden
    const { data: connection, error: connError } = await supabase
      .from("cloud_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Cloud-Verbindung nicht gefunden");
    }

    if (!connection.oauth_refresh_token) {
      throw new Error("Kein Refresh-Token vorhanden. Bitte Google Drive erneut verbinden.");
    }

    // Token refresh
    const tokenData = await refreshGoogleToken(connection.oauth_refresh_token);
    const accessToken = tokenData.access_token;

    // Update access token
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await supabase
      .from("cloud_connections")
      .update({
        oauth_access_token: accessToken,
        oauth_token_expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", connection.id);

    // Belege laden die noch nicht gesichert wurden
    const statusFilter = connection.backup_status_filter || ["review"];
    let query = supabase
      .from("receipts")
      .select("id, file_name, file_url, vendor, amount_gross, receipt_date, category, vat_rate, status, custom_filename")
      .eq("user_id", user.id)
      .is("cloud_backup_at", null)
      .in("status", statusFilter)
      .order("receipt_date", { ascending: true });

    const { data: receipts, error: receiptsError } = await query;

    if (receiptsError) {
      throw new Error(`Belege laden fehlgeschlagen: ${receiptsError.message}`);
    }

    if (!receipts || receipts.length === 0) {
      // Update last backup status
      await supabase
        .from("cloud_connections")
        .update({
          last_backup_at: new Date().toISOString(),
          last_backup_count: 0,
          last_backup_error: null,
        })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true, message: "Keine neuen Belege zum Sichern.", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CSV-Zusammenfassung erstellen
    const csvHeader = "Datum;Lieferant;Brutto;MwSt%;Kategorie;Status;Dateiname;Rechnungsnummer\n";
    const csvRows = receipts.map(r => {
      const date = r.receipt_date || "";
      const vendor = (r.vendor || "").replace(/;/g, ",");
      const amount = r.amount_gross?.toFixed(2) || "";
      const vat = r.vat_rate?.toString() || "";
      const category = (r.category || "").replace(/;/g, ",");
      const status = r.status || "";
      const fileName = (r.custom_filename || r.file_name || "").replace(/;/g, ",");
      return `${date};${vendor};${amount};${vat};${category};${status};${fileName};`;
    }).join("\n");

    const csvContent = new TextEncoder().encode(csvHeader + csvRows);

    // Upload CSV to Drive
    const prefix = connection.backup_file_prefix || "XpenzAI-Backup";
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const csvFileName = `${dateStr}_${prefix}_Zusammenfassung.csv`;

    await uploadFileToDrive(accessToken, csvFileName, csvContent, "text/csv", connection.backup_folder_id || undefined);

    // Upload individual PDFs if enabled
    let uploadedFiles = 0;
    if (connection.backup_include_files) {
      for (const receipt of receipts) {
        if (!receipt.file_url) continue;

        try {
          // Extract storage path from file URL
          const urlParts = receipt.file_url.split("/storage/v1/object/public/");
          if (urlParts.length < 2) continue;

          const storagePath = urlParts[1];
          const bucketAndPath = storagePath.split("/");
          const bucket = bucketAndPath[0];
          const filePath = bucketAndPath.slice(1).join("/");

          const { data: fileData, error: fileError } = await supabase.storage
            .from(bucket)
            .download(filePath);

          if (fileError || !fileData) {
            console.error(`Failed to download ${receipt.file_name}:`, fileError);
            continue;
          }

          const fileBytes = new Uint8Array(await fileData.arrayBuffer());
          const pdfFileName = receipt.custom_filename || receipt.file_name || `beleg_${receipt.id}.pdf`;

          await uploadFileToDrive(accessToken, pdfFileName, fileBytes, "application/pdf", connection.backup_folder_id || undefined);
          uploadedFiles++;
        } catch (fileErr) {
          console.error(`Error uploading file for receipt ${receipt.id}:`, fileErr);
        }
      }
    }

    // Mark receipts as backed up
    const receiptIds = receipts.map(r => r.id);
    const batchSize = 50;
    for (let i = 0; i < receiptIds.length; i += batchSize) {
      const batch = receiptIds.slice(i, i + batchSize);
      await supabase
        .from("receipts")
        .update({ cloud_backup_at: new Date().toISOString() })
        .in("id", batch);
    }

    // Update connection status
    await supabase
      .from("cloud_connections")
      .update({
        last_backup_at: new Date().toISOString(),
        last_backup_count: receipts.length,
        last_backup_error: null,
        last_sync: new Date().toISOString(),
      })
      .eq("id", connection.id);

    console.log(`Backup completed: ${receipts.length} receipts, ${uploadedFiles} files uploaded`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${receipts.length} Belege gesichert${connection.backup_include_files ? `, ${uploadedFiles} PDFs hochgeladen` : ""}.`,
        count: receipts.length,
        filesUploaded: uploadedFiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Backup Error:", error);

    // Try to update connection with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { connectionId } = await req.clone().json().catch(() => ({ connectionId: null }));
      if (connectionId) {
        await supabase
          .from("cloud_connections")
          .update({ last_backup_error: error.message })
          .eq("id", connectionId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
