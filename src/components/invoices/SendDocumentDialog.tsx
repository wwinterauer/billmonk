import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DOC_LABELS: Record<string, string> = {
  invoice: 'Rechnung',
  quote: 'Angebot',
  order_confirmation: 'Auftragsbestätigung',
  delivery_note: 'Lieferschein',
};

interface SendDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  documentType: string;
  customerEmail: string;
  pdfUrl: string;
  onSent: () => void;
}

export function SendDocumentDialog({
  open,
  onOpenChange,
  invoiceNumber,
  documentType,
  customerEmail,
  pdfUrl,
  onSent,
}: SendDocumentDialogProps) {
  const { toast } = useToast();
  const docLabel = DOC_LABELS[documentType] || 'Dokument';

  const [email, setEmail] = useState(customerEmail);
  const [subject, setSubject] = useState(`${docLabel} ${invoiceNumber}`);
  const [body, setBody] = useState(
    `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie ${docLabel === 'Rechnung' ? 'unsere' : documentType === 'quote' ? 'unser' : 'unsere'} ${docLabel} Nr. ${invoiceNumber}.\n\nMit freundlichen Grüßen`
  );

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

  const handleOpenMailClient = () => {
    // Download PDF FIRST, then open mail client after a short delay
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Small delay so download starts before navigation
    setTimeout(() => {
      const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
      onSent();
      onOpenChange(false);
    }, 500);
  };

  const handleCopyLink = async () => {
    if (pdfUrl) {
      await navigator.clipboard.writeText(pdfUrl);
      toast({ title: 'Link kopiert', description: 'Der Download-Link wurde in die Zwischenablage kopiert.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{docLabel} versenden</DialogTitle>
          <DialogDescription>
            Das PDF wird automatisch heruntergeladen. Bitte hängen Sie die heruntergeladene Datei manuell an die E-Mail an — automatisches Anhängen ist aus Sicherheitsgründen im Browser nicht möglich.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Button onClick={handleOpenMailClient} disabled={!email}>
              <Mail className="h-4 w-4 mr-2" />
              In Mail-App öffnen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
