import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Unterstützte Anhang-Typen
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif'];

interface SyncResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: string[];
  lastUid: string | null;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

// Simple IMAP client using Deno's TCP connection
class SimpleImapClient {
  private conn: Deno.TlsConn | Deno.TcpConn | null = null;
  private config: ImapConfig;
  private tagCounter = 0;
  private buffer = "";

  constructor(config: ImapConfig) {
    this.config = config;
  }

  private getTag(): string {
    this.tagCounter++;
    return `A${this.tagCounter.toString().padStart(4, '0')}`;
  }

  async connect(): Promise<void> {
    console.log(`Connecting to ${this.config.host}:${this.config.port}...`);
    
    if (this.config.secure) {
      this.conn = await Deno.connectTls({
        hostname: this.config.host,
        port: this.config.port,
      });
    } else {
      this.conn = await Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
      });
    }

    // Read greeting
    const greeting = await this.readResponse();
    console.log("Server greeting received");

    if (!greeting.includes("OK")) {
      throw new Error("Failed to connect: " + greeting);
    }
  }

  private async readResponse(): Promise<string> {
    if (!this.conn) throw new Error("Not connected");
    
    const decoder = new TextDecoder();
    const buf = new Uint8Array(8192);
    let response = "";
    
    while (true) {
      const n = await this.conn.read(buf);
      if (n === null) break;
      
      response += decoder.decode(buf.subarray(0, n));
      
      // Check if we have a complete response (ends with tagged response)
      if (response.includes("\r\n") && 
          (response.includes("OK") || response.includes("NO") || response.includes("BAD"))) {
        break;
      }
    }
    
    return response;
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error("Not connected");
    
    const tag = this.getTag();
    const fullCommand = `${tag} ${command}\r\n`;
    
    const encoder = new TextEncoder();
    await this.conn.write(encoder.encode(fullCommand));
    
    // Read response until we get tagged response
    const decoder = new TextDecoder();
    const buf = new Uint8Array(65536);
    let response = "";
    
    while (true) {
      const n = await this.conn.read(buf);
      if (n === null) break;
      
      response += decoder.decode(buf.subarray(0, n));
      
      // Check for tagged response
      if (response.includes(`${tag} OK`) || 
          response.includes(`${tag} NO`) || 
          response.includes(`${tag} BAD`)) {
        break;
      }
    }
    
    if (response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
      throw new Error(`IMAP error: ${response}`);
    }
    
    return response;
  }

  async login(): Promise<void> {
    console.log(`Logging in as ${this.config.user}...`);
    const response = await this.sendCommand(
      `LOGIN "${this.config.user}" "${this.config.password}"`
    );
    
    if (!response.includes("OK")) {
      throw new Error("Login failed: " + response);
    }
    console.log("Login successful");
  }

  async select(folder: string): Promise<{ exists: number }> {
    console.log(`Selecting folder: ${folder}`);
    const response = await this.sendCommand(`SELECT "${folder}"`);
    
    // Parse EXISTS count
    const existsMatch = response.match(/\* (\d+) EXISTS/);
    const exists = existsMatch ? parseInt(existsMatch[1]) : 0;
    
    console.log(`Folder selected: ${exists} messages`);
    return { exists };
  }

  async search(criteria: string): Promise<number[]> {
    const response = await this.sendCommand(`SEARCH ${criteria}`);
    
    // Parse message numbers from "* SEARCH 1 2 3 4 5"
    const searchMatch = response.match(/\* SEARCH (.+)/);
    if (!searchMatch) return [];
    
    const numbers = searchMatch[1].trim().split(/\s+/)
      .filter(n => n && /^\d+$/.test(n))
      .map(n => parseInt(n));
    
    return numbers;
  }

  async fetchMessage(msgNum: number): Promise<{ uid: string; raw: string } | null> {
    try {
      // Fetch UID and full message
      const response = await this.sendCommand(`FETCH ${msgNum} (UID BODY[])`);
      
      // Extract UID
      const uidMatch = response.match(/UID (\d+)/);
      const uid = uidMatch ? uidMatch[1] : msgNum.toString();
      
      // Extract body - it's between the first { and the last )
      const bodyStart = response.indexOf("\r\n", response.indexOf("{"));
      const bodyEnd = response.lastIndexOf("\r\n)");
      
      if (bodyStart === -1 || bodyEnd === -1) {
        return null;
      }
      
      const raw = response.substring(bodyStart + 2, bodyEnd);
      
      return { uid, raw };
    } catch (error) {
      console.error(`Error fetching message ${msgNum}:`, error);
      return null;
    }
  }

  async markSeen(msgNum: number): Promise<void> {
    await this.sendCommand(`STORE ${msgNum} +FLAGS (\\Seen)`);
  }

  async logout(): Promise<void> {
    if (this.conn) {
      try {
        await this.sendCommand("LOGOUT");
      } catch {
        // Ignore logout errors
      }
      this.conn.close();
      this.conn = null;
    }
    console.log("Logged out");
  }
}

// Simple email parser
function parseEmail(raw: string): {
  from: string;
  subject: string;
  date: Date | null;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
  }>;
} {
  const result = {
    from: "",
    subject: "",
    date: null as Date | null,
    attachments: [] as Array<{
      filename: string;
      contentType: string;
      content: Uint8Array;
    }>,
  };

  // Split headers and body
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return result;
  
  const headers = raw.substring(0, headerEnd);
  const body = raw.substring(headerEnd + 4);

  // Parse From
  const fromMatch = headers.match(/^From:\s*(.+)$/im);
  if (fromMatch) result.from = fromMatch[1].trim();

  // Parse Subject (handle encoded subjects)
  const subjectMatch = headers.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch) {
    result.subject = decodeRfc2047(subjectMatch[1].trim());
  }

  // Parse Date
  const dateMatch = headers.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    try {
      result.date = new Date(dateMatch[1].trim());
    } catch {
      // Ignore date parsing errors
    }
  }

  // Check for multipart message
  const boundaryMatch = headers.match(/boundary="?([^"\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);
    
    for (const part of parts) {
      if (part.trim() === "" || part.trim() === "--") continue;
      
      const partHeaderEnd = part.indexOf("\r\n\r\n");
      if (partHeaderEnd === -1) continue;
      
      const partHeaders = part.substring(0, partHeaderEnd);
      const partBody = part.substring(partHeaderEnd + 4);
      
      // Check for attachment
      const filenameMatch = partHeaders.match(/filename="?([^"\r\n;]+)"?/i);
      const contentTypeMatch = partHeaders.match(/Content-Type:\s*([^;\r\n]+)/i);
      const encodingMatch = partHeaders.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      
      if (filenameMatch && contentTypeMatch) {
        const filename = decodeRfc2047(filenameMatch[1].trim());
        const contentType = contentTypeMatch[1].trim().toLowerCase();
        const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : "7bit";
        
        // Check if it's a valid attachment type
        const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
        const isValidType = ALLOWED_CONTENT_TYPES.some(t => contentType.includes(t)) ||
                            ALLOWED_EXTENSIONS.includes(extension);
        
        if (isValidType) {
          let content: Uint8Array;
          
          if (encoding === "base64") {
            // Decode base64
            const cleanBase64 = partBody.replace(/[\r\n\s]/g, "");
            try {
              const binaryString = atob(cleanBase64);
              content = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                content[i] = binaryString.charCodeAt(i);
              }
              
              result.attachments.push({ filename, contentType, content });
            } catch (e) {
              console.error(`Failed to decode attachment ${filename}:`, e);
            }
          }
        }
      }
    }
  }

  return result;
}

// Decode RFC 2047 encoded words (=?charset?encoding?text?=)
function decodeRfc2047(str: string): string {
  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        // Base64
        return atob(text);
      } else if (encoding.toUpperCase() === "Q") {
        // Quoted-printable
        return text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_match: string, hex: string) => 
          String.fromCharCode(parseInt(hex, 16))
        );
      }
    } catch {
      // Return original if decoding fails
    }
    return text;
  });
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let accountId: string | null = null;
  let client: SimpleImapClient | null = null;

  try {
    // Auth prüfen
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    accountId = body.accountId;

    if (!accountId) {
      throw new Error("accountId ist erforderlich");
    }

    // Account laden und prüfen ob es dem User gehört
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      throw new Error(`Account nicht gefunden: ${accountError?.message}`);
    }

    console.log(`Starting sync for ${account.email_address}`);

    // Status auf "running" setzen
    await supabase
      .from("email_accounts")
      .update({ 
        last_sync_status: "running", 
        last_sync_at: new Date().toISOString() 
      })
      .eq("id", accountId);

    // Passwort dekodieren (Base64 -> Text)
    const password = atob(account.imap_password_encrypted);

    // IMAP-Verbindung herstellen
    client = new SimpleImapClient({
      host: account.imap_host,
      port: account.imap_port || 993,
      secure: account.imap_use_ssl !== false,
      user: account.imap_username || account.email_address,
      password: password,
    });

    await client.connect();
    await client.login();

    // Mailbox öffnen
    const folder = account.inbox_folder || "INBOX";
    const mailbox = await client.select(folder);
    console.log(`Mailbox opened: ${mailbox.exists} messages`);

    // E-Mails verarbeiten
    const result = await processEmails(client, supabase, account);

    // Verbindung schließen
    await client.logout();
    client = null;

    // Erfolg speichern
    await supabase
      .from("email_accounts")
      .update({
        last_sync_status: result.errors.length > 0 ? "partial" : "success",
        last_sync_at: new Date().toISOString(),
        last_synced_uid: result.lastUid || account.last_synced_uid,
        last_sync_error: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
        total_imported: (account.total_imported || 0) + result.imported,
      })
      .eq("id", accountId);

    return new Response(
      JSON.stringify({
        success: true,
        processed: result.processed,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
        message: `Sync abgeschlossen: ${result.imported} Rechnungen importiert`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("IMAP Sync Error:", error);

    // Verbindung schließen falls noch offen
    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore
      }
    }

    // Fehler-Status speichern
    if (accountId) {
      await supabase
        .from("email_accounts")
        .update({
          last_sync_status: "error",
          last_sync_error: error.message || "Unbekannter Fehler",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", accountId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processEmails(
  client: SimpleImapClient, 
  supabase: any, 
  account: any
): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    lastUid: null,
  };

  try {
    // Ungelesene E-Mails suchen
    let searchCriteria = "UNSEEN";
    
    // Wenn wir eine letzte UID haben, nur neuere holen
    if (account.last_synced_uid) {
      searchCriteria = `UID ${parseInt(account.last_synced_uid) + 1}:* UNSEEN`;
    }

    const messageNums = await client.search(searchCriteria);
    console.log(`Found ${messageNums.length} unread messages`);

    if (messageNums.length === 0) {
      return result;
    }

    // Maximal 20 E-Mails pro Sync verarbeiten
    const toProcess = messageNums.slice(0, 20);

    for (const msgNum of toProcess) {
      result.processed++;

      try {
        const message = await client.fetchMessage(msgNum);
        if (!message) {
          result.skipped++;
          continue;
        }

        result.lastUid = message.uid;

        // E-Mail parsen
        const parsed = parseEmail(message.raw);
        console.log(`Processing: "${parsed.subject}" from ${parsed.from}`);

        // Sender-Filter prüfen
        if (account.sender_filter && account.sender_filter.length > 0) {
          const fromLower = parsed.from.toLowerCase();
          const matchesSender = account.sender_filter.some((filter: string) => 
            fromLower.includes(filter.toLowerCase())
          );
          if (!matchesSender) {
            console.log(`Skipped: Sender not in filter`);
            result.skipped++;
            continue;
          }
        }

        // Betreff-Keywords prüfen
        if (account.subject_keywords && account.subject_keywords.length > 0) {
          const subjectLower = parsed.subject.toLowerCase();
          const matchesKeyword = account.subject_keywords.some((keyword: string) =>
            subjectLower.includes(keyword.toLowerCase())
          );
          if (!matchesKeyword) {
            console.log(`Skipped: Subject doesn't match keywords`);
            result.skipped++;
            continue;
          }
        }

        // Anhänge verarbeiten
        if (parsed.attachments.length === 0) {
          console.log("Skipped: No valid attachments");
          result.skipped++;
          continue;
        }

        for (const attachment of parsed.attachments) {
          // File-Hash für Duplikaterkennung
          const contentBuffer = new Uint8Array(attachment.content).buffer as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', contentBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // Duplikat-Check
          const { data: existingReceipt } = await supabase
            .from("receipts")
            .select("id")
            .eq("user_id", account.user_id)
            .eq("file_hash", fileHash)
            .maybeSingle();

          if (existingReceipt) {
            console.log(`Duplicate: ${attachment.filename}`);
            result.skipped++;
            continue;
          }

          // Email-Attachment Record erstellen
          const { data: emailAttachment, error: attachmentError } = await supabase
            .from("email_attachments")
            .insert({
              email_connection_id: account.id,
              user_id: account.user_id,
              email_message_id: message.uid,
              email_subject: parsed.subject.substring(0, 255),
              email_from: parsed.from.substring(0, 255),
              email_received_at: parsed.date?.toISOString() || new Date().toISOString(),
              attachment_filename: attachment.filename,
              attachment_content_type: attachment.contentType,
              attachment_size: attachment.content.length,
              status: 'processing',
              file_hash: fileHash,
            })
            .select()
            .single();

          if (attachmentError) {
            console.error("Attachment record error:", attachmentError);
            result.errors.push(`Record: ${attachment.filename}`);
            continue;
          }

          // Datei hochladen
          const timestamp = Date.now();
          const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const storagePath = `${account.user_id}/${timestamp}_${sanitizedFilename}`;

          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(storagePath, attachment.content, {
              contentType: attachment.contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            await supabase
              .from("email_attachments")
              .update({ status: 'error', error_message: uploadError.message })
              .eq("id", emailAttachment.id);
            result.errors.push(`Upload: ${attachment.filename}`);
            continue;
          }

          // Receipt erstellen
          const { data: receipt, error: receiptError } = await supabase
            .from("receipts")
            .insert({
              user_id: account.user_id,
              file_name: attachment.filename,
              file_url: storagePath,
              file_type: attachment.contentType,
              file_hash: fileHash,
              status: "pending",
              source: "email_imap",
              email_attachment_id: emailAttachment.id,
              notes: `IMAP Import von ${parsed.from}`,
            })
            .select()
            .single();

          if (receiptError) {
            console.error("Receipt error:", receiptError);
            await supabase
              .from("email_attachments")
              .update({ status: 'error', error_message: receiptError.message })
              .eq("id", emailAttachment.id);
            result.errors.push(`Receipt: ${attachment.filename}`);
            continue;
          }

          // Attachment-Status aktualisieren
          await supabase
            .from("email_attachments")
            .update({ 
              status: 'imported', 
              receipt_id: receipt.id,
              storage_path: storagePath,
              processed_at: new Date().toISOString(),
            })
            .eq("id", emailAttachment.id);

          console.log(`Imported: ${attachment.filename} -> ${receipt.id}`);
          result.imported++;

          // KI-Extraktion triggern (async, nicht warten)
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          fetch(`${supabaseUrl}/functions/v1/extract-receipt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ receiptId: receipt.id }),
          }).catch(e => console.error("AI trigger failed:", e));
        }

        // E-Mail als gelesen markieren
        await client.markSeen(msgNum);

      } catch (msgError: any) {
        console.error(`Error processing message ${msgNum}:`, msgError);
        result.errors.push(`Msg ${msgNum}: ${msgError.message}`);
      }
    }

  } catch (error: any) {
    console.error("processEmails error:", error);
    result.errors.push(error.message);
  }

  return result;
}
