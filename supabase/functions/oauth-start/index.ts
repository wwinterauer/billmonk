import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const MICROSOFT_REDIRECT_URI = Deno.env.get("MICROSOFT_REDIRECT_URI");

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

const MICROSOFT_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth Header prüfen
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Nicht authentifiziert");
    }

    // User verifizieren
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Ungültiger Token");
    }

    const { provider } = await req.json();

    if (!provider || !["gmail", "microsoft"].includes(provider)) {
      throw new Error("Ungültiger Provider. Erlaubt: gmail, microsoft");
    }

    // State Token generieren (CSRF-Schutz)
    const stateToken = crypto.randomUUID();

    // State in DB speichern
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        user_id: user.id,
        provider,
        state_token: stateToken,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      throw new Error(`State konnte nicht gespeichert werden: ${stateError.message}`);
    }

    let authUrl: string;

    if (provider === "gmail") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
        throw new Error("Google OAuth ist nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_REDIRECT_URI in den Edge Function Secrets setzen.");
      }

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: GMAIL_SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        state: stateToken,
      });

      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } 
    else if (provider === "microsoft") {
      if (!MICROSOFT_CLIENT_ID || !MICROSOFT_REDIRECT_URI) {
        throw new Error("Microsoft OAuth ist nicht konfiguriert. Bitte MICROSOFT_CLIENT_ID und MICROSOFT_REDIRECT_URI in den Edge Function Secrets setzen.");
      }

      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        response_type: "code",
        scope: MICROSOFT_SCOPES.join(" "),
        response_mode: "query",
        state: stateToken,
      });

      authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
    } 
    else {
      throw new Error("Provider nicht unterstützt");
    }

    console.log(`OAuth started for ${provider}, user: ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("OAuth Start Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
