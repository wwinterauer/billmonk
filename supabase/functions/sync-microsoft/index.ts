import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let accountId: string | null = null;

  try {
    const body = await req.json();
    accountId = body.accountId;

    if (!accountId) {
      throw new Error("accountId ist erforderlich");
    }

    // Account laden
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("oauth_provider", "microsoft")
      .single();

    if (accountError || !account) {
      throw new Error("Microsoft Account nicht gefunden oder kein OAuth-Account");
    }

    if (!account.oauth_access_token) {
      throw new Error("Kein Access Token vorhanden. Bitte erneut mit Microsoft verbinden.");
    }

    console.log(`Starting Microsoft Graph sync for ${account.email_address}`);

    // Status auf syncing setzen
    await supabase
      .from("email_accounts")
      .update({
        last_sync_status: "running",
        last_sync_attempt: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", accountId);

    // Token refreshen falls nötig
    let accessToken = account.oauth_access_token;

    if (account.oauth_token_expires_at) {
      const expiresAt = new Date(account.oauth_token_expires_at);
      const now = new Date();

      // Refresh wenn Token in weniger als 5 Minuten abläuft
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log("Access Token abgelaufen, refreshe...");
        accessToken = await refreshMicrosoftToken(supabase, account);
      }
    }

    // Microsoft Graph API: Nachrichten mit Anhängen abrufen
    const filterQuery = buildGraphFilter(account);
    console.log(`Graph API filter: ${filterQuery}`);

    // Nachrichten abrufen
    const messagesUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filterQuery)}&$select=id,subject,from,receivedDateTime,hasAttachments&$top=50&$orderby=receivedDateTime desc`;

    const messagesResponse = await fetch(messagesUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.json();

      // Token ungültig
      if (messagesResponse.status === 401) {
        await supabase
          .from("email_accounts")
          .update({
            last_sync_status: "error",
            last_sync_error: "Zugriff abgelaufen. Bitte erneut mit Microsoft verbinden.",
          })
          .eq("id", accountId);
        throw new Error("Microsoft-Zugriff abgelaufen. Bitte erneut verbinden.");
      }

      throw new Error(`Graph API Error: ${errorData.error?.message || messagesResponse.statusText}`);
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.value || [];

    console.log(`Found ${messages.length} messages to check`);

    let processedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      try {
        // Nur Nachrichten mit Anhängen
        if (!msg.hasAttachments) {
          continue;
        }

        // Prüfen ob bereits verarbeitet
        const { data: existingImport } = await supabase
          .from("email_imports")
          .select("id")
          .eq("email_account_id", accountId)
          .eq("message_uid", msg.id)
          .maybeSingle();

        if (existingImport) {
          skippedCount++;
          continue;
        }

        const subject = msg.subject || "(Kein Betreff)";
        const from = msg.from?.emailAddress?.address || "";
        const fromName = msg.from?.emailAddress?.name || "";
        const receivedAt = msg.receivedDateTime;

        console.log(`Processing: "${subject}" from ${from}`);

        // Filter: Betreff-Keywords
        if (account.subject_keywords && account.subject_keywords.length > 0) {
          const matchesKeyword = account.subject_keywords.some((kw: string) =>
            subject.toLowerCase().includes(kw.toLowerCase())
          );
          if (!matchesKeyword) {
            console.log(`  → Skipped: Kein Keyword-Match`);
            skippedCount++;
            continue;
          }
        }

        // Filter: Absender
        if (account.sender_filter && account.sender_filter.length > 0) {
          const matchesSender = account.sender_filter.some((sf: string) =>
            from.toLowerCase().includes(sf.toLowerCase())
          );
          if (!matchesSender) {
            console.log(`  → Skipped: Absender nicht im Filter`);
            skippedCount++;
            continue;
          }
        }

        // Anhänge abrufen
        const attachmentsUrl = `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
        const attachmentsResponse = await fetch(attachmentsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!attachmentsResponse.ok) {
          console.log(`  → Konnte Anhänge nicht laden`);
          continue;
        }

        const attachmentsData = await attachmentsResponse.json();
        const attachments = (attachmentsData.value || []).filter((att: any) => {
          // Nur File Attachments (keine ItemAttachments)
          if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") {
            return false;
          }
          
          const contentType = (att.contentType || "").toLowerCase();
          const filename = (att.name || "").toLowerCase();
          
          const isAllowedType = ALLOWED_CONTENT_TYPES.some(t => contentType.includes(t));
          const isAllowedExt = ALLOWED_EXTENSIONS.some(ext => filename.endsWith(ext));
          
          return isAllowedType || isAllowedExt;
        });

        if (attachments.length === 0) {
          console.log(`  → Skipped: Keine relevanten Anhänge`);
          skippedCount++;
          continue;
        }

        console.log(`  → ${attachments.length} Anhänge gefunden`);

        // Email-Import erstellen
        const { data: emailImport, error: importError } = await supabase
          .from("email_imports")
          .insert({
            user_id: account.user_id,
            email_account_id: accountId,
            message_uid: msg.id,
            from_address: from,
            subject: subject,
            received_at: receivedAt,
            status: "processing",
            attachments_count: attachments.length,
          })
          .select()
          .single();

        if (importError) {
          console.error(`  → Email-Import Error: ${importError.message}`);
          continue;
        }

        // Jeden Anhang verarbeiten
        let importedAttachments = 0;
        for (const att of attachments) {
          const result = await processMicrosoftAttachment(
            supabase,
            account,
            emailImport,
            att,
            { from, fromName, subject }
          );

          if (result.imported) {
            importedAttachments++;
            importedCount++;
          }
        }

        // Nachricht als gelesen markieren (optional)
        try {
          await fetch(`https://graph.microsoft.com/v1.0/me/messages/${msg.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isRead: true }),
          });
        } catch (e) {
          // Ignorieren
        }

        // Import-Status aktualisieren
        await supabase
          .from("email_imports")
          .update({
            status: importedAttachments > 0 ? "completed" : "skipped",
            processed_receipts: importedAttachments,
          })
          .eq("id", emailImport.id);

        processedCount++;

      } catch (msgError: any) {
        console.error(`Error processing message ${msg.id}:`, msgError.message);
      }
    }

    // Erfolg speichern
    await supabase
      .from("email_accounts")
      .update({
        last_sync_status: "success",
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        total_imported: (account.total_imported || 0) + importedCount,
      })
      .eq("id", accountId);

    const message = importedCount > 0
      ? `${importedCount} Rechnung${importedCount > 1 ? "en" : ""} importiert`
      : "Keine neuen Rechnungen gefunden";

    console.log(`Microsoft sync completed: ${processedCount} processed, ${importedCount} imported, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        imported: importedCount,
        skipped: skippedCount,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Microsoft Sync Error:", error);

    if (accountId) {
      await supabase
        .from("email_accounts")
        .update({
          last_sync_status: "error",
          last_sync_error: error.message,
        })
        .eq("id", accountId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// === HELPER FUNCTIONS ===

function buildGraphFilter(account: any): string {
  const filters: string[] = [];

  // Nur E-Mails mit Anhängen
  filters.push("hasAttachments eq true");

  // Zeitfilter
  if (account.last_sync_at) {
    const lastSync = new Date(account.last_sync_at).toISOString();
    filters.push(`receivedDateTime ge ${lastSync}`);
  } else {
    // Erster Sync: letzte 30 Tage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    filters.push(`receivedDateTime ge ${thirtyDaysAgo.toISOString()}`);
  }

  return filters.join(" and ");
}

async function refreshMicrosoftToken(supabase: any, account: any): Promise<string> {
  if (!account.oauth_refresh_token) {
    throw new Error("Kein Refresh Token vorhanden. Bitte erneut mit Microsoft verbinden.");
  }

  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: account.oauth_refresh_token,
        grant_type: "refresh_token",
      }),
    }
  );

  const tokens = await response.json();

  if (tokens.error) {
    await supabase
      .from("email_accounts")
      .update({
        oauth_access_token: null,
        last_sync_status: "error",
        last_sync_error: "Zugriff widerrufen. Bitte erneut mit Microsoft verbinden.",
      })
      .eq("id", account.id);

    throw new Error("Microsoft-Zugriff widerrufen. Bitte erneut verbinden.");
  }

  // Neuen Token speichern
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

  await supabase
    .from("email_accounts")
    .update({
      oauth_access_token: tokens.access_token,
      oauth_refresh_token: tokens.refresh_token || account.oauth_refresh_token,
      oauth_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", account.id);

  console.log("Microsoft token successfully refreshed");
  return tokens.access_token;
}

async function processMicrosoftAttachment(
  supabase: any,
  account: any,
  emailImport: any,
  attachment: any,
  emailInfo: { from: string; fromName: string; subject: string }
): Promise<{ imported: boolean; receiptId?: string }> {
  try {
    const filename = attachment.name || `attachment_${Date.now()}`;
    const contentType = attachment.contentType || "application/octet-stream";

    console.log(`    Processing attachment: ${filename}`);

    // Microsoft liefert Anhang-Daten direkt als Base64
    if (!attachment.contentBytes) {
      console.log(`    → Keine Anhang-Daten`);
      return { imported: false };
    }

    // Base64 zu Uint8Array
    const binaryString = atob(attachment.contentBytes);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Hash für Duplikat-Check
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Duplikat prüfen
    const { data: existingReceipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("file_hash", fileHash)
      .eq("user_id", account.user_id)
      .maybeSingle();

    if (existingReceipt) {
      console.log(`    → Duplikat erkannt`);
      return { imported: false };
    }

    // Storage-Pfad
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${account.user_id}/${year}/${month}/${uuid}_${safeFilename}`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, bytes, {
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.log(`    → Upload Error: ${uploadError.message}`);
      return { imported: false };
    }

    // Email-Attachment Record
    const { data: attachmentRecord } = await supabase
      .from("email_attachments")
      .insert({
        user_id: account.user_id,
        email_connection_id: emailImport.email_connection_id || account.id,
        email_import_id: emailImport.id,
        attachment_filename: filename,
        attachment_content_type: contentType,
        attachment_size: bytes.length,
        storage_path: storagePath,
        file_hash: fileHash,
        status: "pending",
        email_subject: emailInfo.subject,
        email_from: emailInfo.from,
      })
      .select()
      .single();

    // Receipt erstellen
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        user_id: account.user_id,
        file_url: storagePath,
        file_name: filename,
        file_type: contentType,
        file_hash: fileHash,
        status: "pending",
        source: "email_imap",
        email_attachment_id: attachmentRecord?.id || null,
        notes: `Microsoft-Import von ${emailInfo.from}: ${emailInfo.subject}`.substring(0, 500),
      })
      .select()
      .single();

    if (receiptError) {
      console.log(`    → Receipt Error: ${receiptError.message}`);
      return { imported: false };
    }

    // Attachment verknüpfen
    if (attachmentRecord) {
      await supabase
        .from("email_attachments")
        .update({ receipt_id: receipt.id, status: "imported" })
        .eq("id", attachmentRecord.id);
    }

    // KI-Extraktion triggern
    supabase.functions
      .invoke("extract-receipt", { body: { receiptId: receipt.id } })
      .catch(() => {});

    console.log(`    ✓ Importiert: ${filename} → Receipt ${receipt.id}`);
    return { imported: true, receiptId: receipt.id };

  } catch (error: any) {
    console.error(`    → Attachment Error: ${error.message}`);
    return { imported: false };
  }
}
