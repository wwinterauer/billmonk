import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, MailX } from "lucide-react";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (res.ok && data.valid === true) {
          setStatus("valid");
        } else if (data.reason === "already_unsubscribed") {
          setStatus("already");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result.success) {
        setStatus("success");
      } else if (result.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Wird geladen…</p>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">E-Mail-Benachrichtigungen abbestellen</h1>
              <p className="text-muted-foreground text-sm">
                Möchtest du keine App-E-Mails mehr von BillMonk erhalten?
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Abbestellen bestätigen
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
              <h1 className="text-xl font-semibold">Erfolgreich abbestellt</h1>
              <p className="text-muted-foreground text-sm">
                Du erhältst keine App-E-Mails mehr von BillMonk.
              </p>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-semibold">Bereits abbestellt</h1>
              <p className="text-muted-foreground text-sm">
                Du hast dich bereits abgemeldet.
              </p>
            </>
          )}
          {status === "invalid" && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-xl font-semibold">Ungültiger Link</h1>
              <p className="text-muted-foreground text-sm">
                Dieser Abmeldelink ist ungültig oder abgelaufen.
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-xl font-semibold">Fehler</h1>
              <p className="text-muted-foreground text-sm">
                Die Abmeldung konnte nicht durchgeführt werden. Bitte versuche es später erneut.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
