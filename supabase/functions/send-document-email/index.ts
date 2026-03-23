import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

// Map IMAP hosts to SMTP hosts
const SMTP_HOST_MAP: Record<string, string> = {
  "imap.gmail.com": "smtp.gmail.com",
  "imap.gmx.net": "mail.gmx.net",
  "imap.web.de": "smtp.web.de",
  "imap.mail.yahoo.com": "smtp.mail.yahoo.com",
  "outlook.office365.com": "smtp.office365.com",
  "imap.ionos.de": "smtp.ionos.de",
  "imap.1und1.de": "smtp.1und1.de",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Nicht authentifiziert");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Ungültiger Token");

    const { accountId, recipientEmail, subject, body, pdfStoragePath, invoiceId, fileName } = await req.json();

    if (!accountId || !recipientEmail || !subject || !pdfStoragePath) {
      throw new Error("accountId, recipientEmail, subject und pdfStoragePath sind erforderlich");
    }

    // Load account
    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) throw new Error("E-Mail-Konto nicht gefunden");

    // Load PDF from storage
    const { data: pdfData, error: pdfErr } = await supabase.storage
      .from("invoices")
      .download(pdfStoragePath);

    if (pdfErr || !pdfData) throw new Error("PDF konnte nicht geladen werden");

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    const pdfFilename = fileName || `${invoiceId || "document"}.pdf`;

    // Build MIME message
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
    const fromEmail = account.email_address;
    const textBody = body || "";

    const mimeMessage = [
      `From: ${fromEmail}`,
      `To: ${recipientEmail}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(textBody))),
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      pdfBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    let sendResult: { success: boolean; error?: string };

    if (account.oauth_provider === "gmail") {
      sendResult = await sendViaGmail(supabase, account, mimeMessage);
    } else {
      sendResult = await sendViaSMTP(account, mimeMessage);
    }

    if (!sendResult.success) {
      throw new Error(sendResult.error || "E-Mail konnte nicht gesendet werden");
    }

    // Update invoice status
    if (invoiceId) {
      await supabase
        .from("invoices")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_to_email: recipientEmail,
        })
        .eq("id", invoiceId)
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "E-Mail erfolgreich versendet" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Send Document Email Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// === Gmail API Send ===
async function sendViaGmail(supabase: any, account: any, mimeMessage: string): Promise<{ success: boolean; error?: string }> {
  let accessToken = account.oauth_access_token;

  if (!accessToken) {
    return { success: false, error: "Kein Access Token. Bitte Gmail erneut verbinden." };
  }

  // Refresh token if needed
  if (account.oauth_token_expires_at) {
    const expiresAt = new Date(account.oauth_token_expires_at).getTime();
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      accessToken = await refreshGoogleToken(supabase, account);
    }
  }

  // Base64url encode the MIME message
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(mimeMessage);
  const base64url = btoa(String.fromCharCode(...messageBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64url }),
    }
  );

  if (!response.ok) {
    const errData = await response.json();
    return { success: false, error: `Gmail API Fehler: ${errData.error?.message || response.statusText}` };
  }

  await response.json(); // consume body
  return { success: true };
}

// === SMTP Send ===
async function sendViaSMTP(account: any, mimeMessage: string): Promise<{ success: boolean; error?: string }> {
  const imapHost = account.imap_host;
  const smtpHost = SMTP_HOST_MAP[imapHost] || imapHost.replace("imap.", "smtp.");
  const smtpPort = 587;

  try {
    // Connect to SMTP server
    const conn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const readResponse = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      if (n === null) throw new Error("Verbindung geschlossen");
      return decoder.decode(buf.subarray(0, n));
    };

    const sendCommand = async (cmd: string): Promise<string> => {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await readResponse();
    };

    // Read greeting
    await readResponse();

    // EHLO
    let ehloResp = await sendCommand(`EHLO localhost`);

    // STARTTLS
    if (ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      const tlsConn = await Deno.startTls(conn, { hostname: smtpHost });

      // Re-assign read/write to TLS connection
      const tlsReadResponse = async (): Promise<string> => {
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        if (n === null) throw new Error("TLS-Verbindung geschlossen");
        return decoder.decode(buf.subarray(0, n));
      };

      const tlsSendCommand = async (cmd: string): Promise<string> => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
        return await tlsReadResponse();
      };

      await tlsSendCommand(`EHLO localhost`);

      // AUTH LOGIN
      const authResp = await tlsSendCommand("AUTH LOGIN");
      if (!authResp.startsWith("334")) {
        tlsConn.close();
        return { success: false, error: "SMTP AUTH nicht unterstützt" };
      }

      await tlsSendCommand(btoa(account.imap_username));
      
      // Decrypt password - it's stored encrypted
      const password = account.imap_password_encrypted;
      const passResp = await tlsSendCommand(btoa(password));
      if (!passResp.startsWith("235")) {
        tlsConn.close();
        return { success: false, error: "SMTP Authentifizierung fehlgeschlagen" };
      }

      // MAIL FROM
      await tlsSendCommand(`MAIL FROM:<${account.email_address}>`);

      // RCPT TO - extract from MIME
      const toMatch = mimeMessage.match(/^To: (.+)$/m);
      const recipient = toMatch ? toMatch[1].trim() : "";
      await tlsSendCommand(`RCPT TO:<${recipient}>`);

      // DATA
      const dataResp = await tlsSendCommand("DATA");
      if (!dataResp.startsWith("354")) {
        tlsConn.close();
        return { success: false, error: "SMTP DATA nicht akzeptiert" };
      }

      // Send message body
      await tlsConn.write(encoder.encode(mimeMessage + "\r\n.\r\n"));
      const sendResp = await tlsReadResponse();

      if (!sendResp.startsWith("250")) {
        tlsConn.close();
        return { success: false, error: `SMTP Sendefehler: ${sendResp}` };
      }

      await tlsSendCommand("QUIT");
      tlsConn.close();
      return { success: true };
    }

    conn.close();
    return { success: false, error: "STARTTLS nicht unterstützt" };

  } catch (err: any) {
    return { success: false, error: `SMTP Fehler: ${err.message}` };
  }
}

// === Token Refresh ===
async function refreshGoogleToken(supabase: any, account: any): Promise<string> {
  if (!account.oauth_refresh_token) {
    throw new Error("Kein Refresh Token. Bitte Gmail erneut verbinden.");
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
    throw new Error("Gmail-Zugriff widerrufen. Bitte erneut verbinden.");
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
  await supabase
    .from("email_accounts")
    .update({
      oauth_access_token: tokens.access_token,
      oauth_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", account.id);

  return tokens.access_token;
}
