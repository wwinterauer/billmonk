import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Link2, Send, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DOC_LABELS: Record<string, string> = {
  invoice: 'Rechnung',
  quote: 'Angebot',
  order_confirmation: 'Auftragsbestätigung',
  delivery_note: 'Lieferschein',
};

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  oauth_provider: string | null;
  provider: string | null;
}

interface SendDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoiceId?: string | null;
  documentType: string;
  customerEmail: string;
  pdfUrl: string;
  pdfStoragePath?: string | null;
  onSent: () => void;
}

export function SendDocumentDialog({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceId,
  documentType,
  customerEmail,
  pdfUrl,
  pdfStoragePath,
  onSent,
}: SendDocumentDialogProps) {
  const { toast } = useToast();
  const docLabel = DOC_LABELS[documentType] || 'Dokument';

  const [email, setEmail] = useState(customerEmail);
  const [subject, setSubject] = useState(`${docLabel} ${invoiceNumber}`);
  const [body, setBody] = useState(
    `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie ${docLabel === 'Rechnung' ? 'unsere' : documentType === 'quote' ? 'unser' : 'unsere'} ${docLabel} Nr. ${invoiceNumber}.\n\nMit freundlichen Grüßen`
  );
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Load email accounts
  useEffect(() => {
    if (!open) return;
    
    const loadAccounts = async () => {
      setLoadingAccounts(true);
      const { data } = await supabase
        .from('email_accounts')
        .select('id, email_address, display_name, oauth_provider, provider')
        .eq('is_active', true);
      
      if (data && data.length > 0) {
        setAccounts(data);
        setSelectedAccountId(data[0].id);
      } else {
        setAccounts([]);
        setSelectedAccountId('');
      }
      setLoadingAccounts(false);
    };

    loadAccounts();
  }, [open]);

  // Reset fields when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setEmail(customerEmail);
      setSubject(`${docLabel} ${invoiceNumber}`);
      setBody(
        `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie ${docLabel === 'Rechnung' ? 'unsere' : documentType === 'quote' ? 'unser' : 'unsere'} ${docLabel} Nr. ${invoiceNumber}.\n\nMit freundlichen Grüßen`
      );
    }
    onOpenChange(newOpen);
  };

  const handleDirectSend = async () => {
    if (!selectedAccountId || !email || !pdfStoragePath) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          accountId: selectedAccountId,
          recipientEmail: email,
          subject,
          body,
          pdfStoragePath,
          invoiceId,
          fileName: `${invoiceNumber}.pdf`,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast({ title: 'E-Mail versendet', description: `${docLabel} wurde erfolgreich an ${email} gesendet.` });
      onSent();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Fehler beim Versand', description: err.message || 'E-Mail konnte nicht gesendet werden.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleOpenMailClient = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mailLink = document.createElement('a');
    mailLink.href = mailtoUrl;
    mailLink.style.display = 'none';
    document.body.appendChild(mailLink);
    mailLink.click();
    document.body.removeChild(mailLink);

    onSent();
    onOpenChange(false);
  };

  const handleCopyLink = async () => {
    if (pdfUrl) {
      await navigator.clipboard.writeText(pdfUrl);
      toast({ title: 'Link kopiert', description: 'Der Download-Link wurde in die Zwischenablage kopiert.' });
    }
  };

  const canDirectSend = accounts.length > 0 && selectedAccountId && pdfStoragePath;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{docLabel} versenden</DialogTitle>
          <DialogDescription>
            {canDirectSend
              ? `${docLabel} wird mit dem PDF als Anhang direkt über Ihr E-Mail-Konto gesendet.`
              : 'Das PDF wird heruntergeladen. Bitte hängen Sie es manuell an die E-Mail an.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account selector */}
          {accounts.length > 0 && pdfStoragePath && (
            <div className="space-y-2">
              <Label>Senden über</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="E-Mail-Konto wählen" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.email_address}
                      {acc.oauth_provider === 'gmail' ? ' (Gmail)' : acc.provider ? ` (${acc.provider})` : ' (IMAP)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!pdfStoragePath && accounts.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Bitte generieren Sie zuerst die PDF-Vorschau, um direkt versenden zu können.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Empfänger</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail-Adresse" />
          </div>

          <div className="space-y-2">
            <Label>Betreff</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Nachricht</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Link2 className="h-4 w-4 mr-1" />
              Link kopieren
            </Button>
            <Button variant="outline" onClick={handleOpenMailClient} disabled={!email}>
              <Mail className="h-4 w-4 mr-2" />
              Mail-App
            </Button>
            {canDirectSend && (
              <Button onClick={handleDirectSend} disabled={!email || sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Direkt versenden
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
