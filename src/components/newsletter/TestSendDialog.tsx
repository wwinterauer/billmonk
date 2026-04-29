import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TestSendDialogProps {
  newsletterId: string;
  newsletterSubject?: string;
  trigger: ReactNode;
}

export function TestSendDialog({ newsletterId, newsletterSubject, trigger }: TestSendDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email && !email) setEmail(data.user.email);
    });
  }, [open]);

  const handleSend = async () => {
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      toast.error('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: newsletterId, test_mode: true, test_email: target },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Test-E-Mail an ${target} gesendet.`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Testversand fehlgeschlagen.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Testversand
          </DialogTitle>
          <DialogDescription>
            {newsletterSubject ? <>Newsletter: <strong>{newsletterSubject}</strong>.<br /></> : null}
            Sendet eine Test-E-Mail an die angegebene Adresse. Echte Empfänger werden nicht
            benachrichtigt, der Newsletter-Status bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="test-email">E-Mail-Adresse</Label>
          <Input
            id="test-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@beispiel.de"
            disabled={sending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Abbrechen
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Testversand starten
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
