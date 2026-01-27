import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg", 
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

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
      .eq("oauth_provider", "gmail")
      .single();

    if (accountError || !account) {
      throw new Error("Gmail Account nicht gefunden oder kein OAuth-Account");
    }

    if (!account.oauth_access_token) {
      throw new Error("Kein Access Token vorhanden. Bitte erneut mit Gmail verbinden.");
    }

    console.log(`Starting Gmail API sync for ${account.email_address}`);

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
        accessToken = await refreshGoogleToken(supabase, account);
      }
    }

    // Gmail API: Nachrichten suchen
    const query = buildGmailQuery(account);
    console.log(`Gmail search query: ${query}`);
    
    const messagesUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;
    
    const messagesResponse = await fetch(messagesUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.json();
      
      // Token ungültig -> erneute Authentifizierung nötig
      if (messagesResponse.status === 401) {
        await supabase
          .from("email_accounts")
          .update({ 
            last_sync_status: "error",
            last_sync_error: "Zugriff abgelaufen. Bitte erneut mit Gmail verbinden.",
          })
          .eq("id", accountId);
        throw new Error("Gmail-Zugriff abgelaufen. Bitte erneut verbinden.");
      }
      
      throw new Error(`Gmail API Error: ${errorData.error?.message || messagesResponse.statusText}`);
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.messages || [];

    console.log(`Found ${messages.length} messages to check`);

    let processedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      try {
        // Prüfen ob Message-ID bereits verarbeitet wurde (über last_synced_uid)
        // Wir speichern verarbeitete Message-IDs nicht einzeln, stattdessen nutzen wir den Zeitfilter

        // Volle Nachricht laden
        const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const messageResponse = await fetch(messageUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!messageResponse.ok) {
          console.log(`Konnte Nachricht ${msg.id} nicht laden`);
          continue;
        }

        const messageData = await messageResponse.json();
        
        // Header extrahieren
        const headers = messageData.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("Subject") || "(Kein Betreff)";
        const from = getHeader("From");
        const date = getHeader("Date");
        const messageIdHeader = getHeader("Message-ID");

        console.log(`Processing: "${subject.substring(0, 50)}..." from ${from}`);

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

        // Anhänge finden
        const attachments = findAttachments(messageData.payload);

        if (attachments.length === 0) {
          console.log(`  → Skipped: Keine relevanten Anhänge`);
          skippedCount++;
          continue;
        }

        console.log(`  → ${attachments.length} Anhänge gefunden`);

        // Jeden Anhang verarbeiten
        for (const att of attachments) {
          const result = await processGmailAttachment(
            supabase,
            account,
            msg.id,
            att,
            accessToken,
            { from, subject, date, messageIdHeader }
          );
          
          if (result.imported) {
            importedCount++;
          } else {
            skippedCount++;
          }
        }

        // Email als gelesen markieren (optional)
        try {
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
            }
          );
        } catch (e) {
          // Ignorieren wenn als-gelesen-markieren fehlschlägt
        }

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
      ? `${importedCount} Rechnung${importedCount > 1 ? 'en' : ''} importiert`
      : "Keine neuen Rechnungen gefunden";

    console.log(`Gmail sync completed: ${processedCount} processed, ${importedCount} imported, ${skippedCount} skipped`);

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
    console.error("Gmail Sync Error:", error);

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

function buildGmailQuery(account: any): string {
  const parts: string[] = [];
  
  // Nur mit Anhängen
  parts.push("has:attachment");
  
  // Standard: nur Inbox
  const folder = account.inbox_folder || "INBOX";
  if (folder.toUpperCase() === "INBOX") {
    parts.push("in:inbox");
  }
  
  // Zeitfilter: nur seit letztem Sync oder letzte 30 Tage
  if (account.last_sync_at) {
    const lastSync = new Date(account.last_sync_at);
    const year = lastSync.getFullYear();
    const month = lastSync.getMonth() + 1;
    const day = lastSync.getDate();
    parts.push(`after:${year}/${month}/${day}`);
  } else {
    // Erster Sync: letzte 30 Tage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const year = thirtyDaysAgo.getFullYear();
    const month = thirtyDaysAgo.getMonth() + 1;
    const day = thirtyDaysAgo.getDate();
    parts.push(`after:${year}/${month}/${day}`);
  }
  
  return parts.join(" ");
}

function findAttachments(payload: any, attachments: any[] = []): any[] {
  // Prüfe ob dieser Part ein Anhang ist
  if (payload.body?.attachmentId && payload.filename) {
    const mimeType = (payload.mimeType || "").toLowerCase();
    const filename = payload.filename.toLowerCase();
    
    // Prüfe MIME-Type
    const isAllowedMime = ALLOWED_MIME_TYPES.some(t => mimeType.includes(t.split("/")[1]));
    
    // Prüfe Dateiendung als Fallback
    const isAllowedExt = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"]
      .some(ext => filename.endsWith(ext));
    
    if (isAllowedMime || isAllowedExt) {
      attachments.push({
        attachmentId: payload.body.attachmentId,
        filename: payload.filename,
        mimeType: payload.mimeType || "application/octet-stream",
        size: payload.body.size || 0,
      });
    }
  }

  // Rekursiv durch alle Parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      findAttachments(part, attachments);
    }
  }

  return attachments;
}

async function refreshGoogleToken(supabase: any, account: any): Promise<string> {
  if (!account.oauth_refresh_token) {
    throw new Error("Kein Refresh Token vorhanden. Bitte erneut mit Gmail verbinden.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: account.oauth_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await response.json();

  if (tokens.error) {
    // Refresh Token ungültig -> User muss neu verbinden
    await supabase
      .from("email_accounts")
      .update({ 
        oauth_access_token: null,
        last_sync_status: "error",
        last_sync_error: "Zugriff widerrufen. Bitte erneut mit Gmail verbinden.",
      })
      .eq("id", account.id);
    
    throw new Error("Gmail-Zugriff widerrufen. Bitte erneut verbinden.");
  }

  // Neuen Token speichern
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
  
  await supabase
    .from("email_accounts")
    .update({
      oauth_access_token: tokens.access_token,
      oauth_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", account.id);

  console.log("Token successfully refreshed");
  return tokens.access_token;
}

async function processGmailAttachment(
  supabase: any,
  account: any,
  messageId: string,
  attachment: any,
  accessToken: string,
  emailInfo: { from: string; subject: string; date: string; messageIdHeader: string }
): Promise<{ imported: boolean; receiptId?: string }> {
  try {
    console.log(`    Processing attachment: ${attachment.filename}`);

    // Anhang-Daten von Gmail API laden
    const attachmentUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`;
    const attachmentResponse = await fetch(attachmentUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!attachmentResponse.ok) {
      console.log(`    → Konnte Anhang nicht laden: ${attachmentResponse.status}`);
      return { imported: false };
    }

    const attachmentData = await attachmentResponse.json();
    
    if (!attachmentData.data) {
      console.log(`    → Keine Anhang-Daten erhalten`);
      return { imported: false };
    }

    // Base64 URL-safe zu Standard Base64 konvertieren
    const base64Data = attachmentData.data
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    
    // Zu Uint8Array konvertieren
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Hash für Duplikat-Check berechnen
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Duplikat in receipts prüfen
    const { data: existingReceipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("file_hash", fileHash)
      .eq("user_id", account.user_id)
      .maybeSingle();

    if (existingReceipt) {
      console.log(`    → Duplikat erkannt (Receipt existiert bereits)`);
      return { imported: false };
    }

    // Storage-Pfad generieren
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${account.user_id}/${year}/${month}/${uuid}_${safeFilename}`;

    // In Supabase Storage hochladen
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, bytes, {
        contentType: attachment.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.log(`    → Upload Error: ${uploadError.message}`);
      return { imported: false };
    }

    // Email-Attachment Record erstellen
    const { data: attachmentRecord, error: attError } = await supabase
      .from("email_attachments")
      .insert({
        user_id: account.user_id,
        email_connection_id: account.id,
        email_message_id: messageId,
        email_subject: emailInfo.subject.substring(0, 255),
        email_from: emailInfo.from.substring(0, 255),
        email_received_at: emailInfo.date ? new Date(emailInfo.date).toISOString() : new Date().toISOString(),
        attachment_filename: attachment.filename,
        attachment_content_type: attachment.mimeType,
        attachment_size: bytes.length,
        storage_path: storagePath,
        file_hash: fileHash,
        status: "processing",
      })
      .select()
      .single();

    if (attError) {
      console.log(`    → Attachment Record Error: ${attError.message}`);
    }

    // Receipt erstellen
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        user_id: account.user_id,
        file_url: storagePath,
        file_name: attachment.filename,
        file_type: attachment.mimeType,
        file_hash: fileHash,
        status: "pending",
        source: "email_gmail",
        email_attachment_id: attachmentRecord?.id || null,
        notes: `Gmail: ${emailInfo.from} - ${emailInfo.subject}`.substring(0, 500),
      })
      .select()
      .single();

    if (receiptError) {
      console.log(`    → Receipt Error: ${receiptError.message}`);
      return { imported: false };
    }

    // Attachment mit Receipt verknüpfen
    if (attachmentRecord) {
      await supabase
        .from("email_attachments")
        .update({ receipt_id: receipt.id, status: "imported" })
        .eq("id", attachmentRecord.id);
    }

    // KI-Extraktion asynchron triggern
    supabase.functions.invoke("extract-receipt", {
      body: { receiptId: receipt.id },
    }).catch((e: any) => {
      console.log(`    → KI-Extraktion getriggert (async)`);
    });

    console.log(`    ✓ Importiert: ${attachment.filename} → Receipt ${receipt.id}`);
    return { imported: true, receiptId: receipt.id };

  } catch (error: any) {
    console.error(`    → Attachment Error: ${error.message}`);
    return { imported: false };
  }
}
