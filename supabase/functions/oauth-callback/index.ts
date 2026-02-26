import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
const MICROSOFT_REDIRECT_URI = Deno.env.get("MICROSOFT_REDIRECT_URI");

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://id-preview--430e6085-1d7d-43f1-8d01-b2631b5aa0a4.lovable.app";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Redirect Helper
  const redirectWithError = (message: string, tab = "email-import") => {
    const redirectUrl = `${FRONTEND_URL}/settings?tab=${tab}&oauth_error=${encodeURIComponent(message)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  };

  const redirectWithSuccess = (provider: string, tab = "email-import") => {
    const redirectUrl = `${FRONTEND_URL}/settings?tab=${tab}&oauth_success=${provider}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  };

  try {
    // OAuth Fehler vom Provider
    if (error) {
      console.error("OAuth error from provider:", error, errorDescription);
      return redirectWithError("Authentifizierung fehlgeschlagen. Bitte erneut versuchen.");
    }

    if (!code || !state) {
      return redirectWithError("Fehlende Parameter (code oder state)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // State verifizieren und laden
    const { data: stateData, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error("Invalid or expired state:", stateError);
      return redirectWithError("Ungültiger oder abgelaufener Sicherheitstoken. Bitte erneut versuchen.");
    }

    const { user_id, provider } = stateData;

    // State löschen (einmalig verwendbar)
    await supabase.from("oauth_states").delete().eq("id", stateData.id);

    let tokens: any;
    let userEmail: string;

    // === GMAIL ===
    if (provider === "gmail") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        throw new Error("Google OAuth nicht vollständig konfiguriert");
      }

      // Token Exchange
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Google token error:", tokens);
        throw new Error(tokens.error_description || tokens.error);
      }

      // User-Info abrufen
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      
      if (!userInfoResponse.ok) {
        throw new Error("Konnte Gmail-Benutzerdaten nicht abrufen");
      }
      
      const userInfo = await userInfoResponse.json();
      userEmail = userInfo.email;

      if (!userEmail) {
        throw new Error("Keine E-Mail-Adresse vom Google-Konto erhalten");
      }
    }

    // === MICROSOFT ===
    else if (provider === "microsoft") {
      if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REDIRECT_URI) {
        throw new Error("Microsoft OAuth nicht vollständig konfiguriert");
      }

      // Token Exchange
      const tokenResponse = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            redirect_uri: MICROSOFT_REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        }
      );

      tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Microsoft token error:", tokens);
        throw new Error(tokens.error_description || tokens.error);
      }

      // User-Info abrufen
      const userInfoResponse = await fetch(
        "https://graph.microsoft.com/v1.0/me",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      
      if (!userInfoResponse.ok) {
        throw new Error("Konnte Microsoft-Benutzerdaten nicht abrufen");
      }
      
      const userInfo = await userInfoResponse.json();
      userEmail = userInfo.mail || userInfo.userPrincipalName;

      if (!userEmail) {
        throw new Error("Keine E-Mail-Adresse vom Microsoft-Konto erhalten");
      }
    }
    // === GOOGLE DRIVE ===
    else if (provider === "google_drive") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        throw new Error("Google OAuth nicht vollständig konfiguriert");
      }

      // Token Exchange
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Google Drive token error:", tokens);
        throw new Error(tokens.error_description || tokens.error);
      }

      // User-Info abrufen
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      
      if (!userInfoResponse.ok) {
        throw new Error("Konnte Google-Benutzerdaten nicht abrufen");
      }
      
      const userInfo = await userInfoResponse.json();
      userEmail = userInfo.email;

      if (!userEmail) {
        throw new Error("Keine E-Mail-Adresse vom Google-Konto erhalten");
      }

      // Save to cloud_connections instead of email_accounts
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      const { data: existingConnection } = await supabase
        .from("cloud_connections")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", "google_drive")
        .maybeSingle();

      if (existingConnection) {
        const { error: updateError } = await supabase
          .from("cloud_connections")
          .update({
            oauth_access_token: tokens.access_token,
            oauth_refresh_token: tokens.refresh_token || null,
            oauth_token_expires_at: expiresAt.toISOString(),
            display_name: userEmail,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingConnection.id);

        if (updateError) {
          throw new Error(`Cloud-Verbindung Update fehlgeschlagen: ${updateError.message}`);
        }
        console.log(`Updated Google Drive connection: ${existingConnection.id}`);
      } else {
        const { error: insertError } = await supabase
          .from("cloud_connections")
          .insert({
            user_id,
            provider: "google_drive",
            display_name: userEmail,
            oauth_access_token: tokens.access_token,
            oauth_refresh_token: tokens.refresh_token || null,
            oauth_token_expires_at: expiresAt.toISOString(),
            is_active: true,
            backup_enabled: false,
            backup_schedule_type: "weekly",
            backup_weekday: 1,
            backup_time: "02:00",
            backup_file_prefix: "XpenzAI-Backup",
            backup_include_files: true,
            backup_status_filter: ["review"],
          });

        if (insertError) {
          throw new Error(`Cloud-Verbindung Erstellung fehlgeschlagen: ${insertError.message}`);
        }
        console.log(`Created Google Drive connection for ${userEmail}`);
      }

      return redirectWithSuccess(provider, "cloud-storage");
    }
    else {
      throw new Error(`Unbekannter Provider: ${provider}`);
    }

    console.log(`OAuth successful for ${provider}, email: ${userEmail}, user: ${user_id}`);

    // Token-Ablaufzeit berechnen
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // IMAP-Konfiguration für OAuth-Provider
    const imapConfig = provider === "gmail" 
      ? { imap_host: "imap.gmail.com", imap_port: 993, imap_use_ssl: true }
      : { imap_host: "outlook.office365.com", imap_port: 993, imap_use_ssl: true };

    // Prüfen ob Account bereits existiert
    const { data: existingAccount } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("user_id", user_id)
      .eq("email_address", userEmail)
      .maybeSingle();

    if (existingAccount) {
      // Bestehenden Account aktualisieren
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update({
          oauth_provider: provider,
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token || null,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_scope: tokens.scope || null,
          is_active: true,
          last_sync_status: "idle",
          last_sync_error: null,
          ...imapConfig,
        })
        .eq("id", existingAccount.id);

      if (updateError) {
        throw new Error(`Account-Update fehlgeschlagen: ${updateError.message}`);
      }

      console.log(`Updated existing account: ${existingAccount.id}`);
    } else {
      // Neuen Account erstellen
      const { error: insertError } = await supabase
        .from("email_accounts")
        .insert({
          user_id,
          email_address: userEmail,
          display_name: userEmail,
          imap_username: userEmail,
          imap_password_encrypted: "",
          oauth_provider: provider,
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token || null,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_scope: tokens.scope || null,
          is_active: true,
          sync_interval: "15min",
          inbox_folder: "INBOX",
          last_sync_status: "idle",
          ...imapConfig,
        });

      if (insertError) {
        throw new Error(`Account-Erstellung fehlgeschlagen: ${insertError.message}`);
      }

      console.log(`Created new ${provider} account for ${userEmail}`);
    }

    return redirectWithSuccess(provider);

  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return redirectWithError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
  }
});
