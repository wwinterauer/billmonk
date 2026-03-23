import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { PdfPreviewDialog } from './PdfPreviewDialog';
import { SendDocumentDialog } from './SendDocumentDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, CheckCircle, Send, Printer, Download, Loader2, FileText, Maximize2 } from 'lucide-react';

interface DocumentPreviewPanelProps {
  invoiceId: string | null;
  invoiceNumber: string;
  documentType: string;
  currentStatus: string;
  pdfUrl: string | null;
  customerEmail?: string | null;
  onStatusChange: (status: string) => void;
  onPdfGenerated: (url: string) => void;
  disabled?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Entwurf', className: 'bg-secondary text-secondary-foreground' },
  approved: { label: 'Freigegeben', className: 'border-green-500 text-green-700 dark:text-green-400' },
  sent: { label: 'Versendet', className: 'bg-primary text-primary-foreground' },
  paid: { label: 'Bezahlt', className: 'border-green-600 text-green-700 dark:text-green-400' },
};

const DOC_LABELS: Record<string, string> = {
  invoice: 'Rechnung',
  quote: 'Angebot',
  order_confirmation: 'Auftragsbestätigung',
  delivery_note: 'Lieferschein',
};

export function DocumentPreviewPanel({
  invoiceId,
  invoiceNumber,
  documentType,
  currentStatus,
  pdfUrl,
  customerEmail,
  onStatusChange,
  onPdfGenerated,
  disabled,
}: DocumentPreviewPanelProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const docLabel = DOC_LABELS[documentType] || 'Dokument';
  const statusInfo = STATUS_LABELS[currentStatus] || STATUS_LABELS.draft;

  const handleGeneratePreview = async () => {
    if (!invoiceId) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;

      // Fetch the updated invoice to get the pdf_storage_path
      const { data: inv } = await supabase
        .from('invoices')
        .select('pdf_storage_path')
        .eq('id', invoiceId)
        .single();

      if (inv?.pdf_storage_path) {
        const { data: signedData } = await supabase.storage
          .from('invoices')
          .createSignedUrl(inv.pdf_storage_path, 3600);
        if (signedData?.signedUrl) {
          onPdfGenerated(signedData.signedUrl);
        }
      }
      toast({ title: 'Vorschau generiert' });
    } catch {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!invoiceId) return;
    const { error } = await supabase.from('invoices').update({ status: 'approved' } as any).eq('id', invoiceId);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    onStatusChange('approved');
    toast({ title: `${docLabel} freigegeben` });
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const w = window.open(pdfUrl, '_blank');
    if (w) {
      w.addEventListener('load', () => {
        setTimeout(() => w.print(), 500);
      });
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
  };

  const handleSendComplete = async () => {
    if (!invoiceId) return;
    const { error } = await supabase.from('invoices').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    } as any).eq('id', invoiceId);
    if (!error) {
      onStatusChange('sent');
      toast({ title: `${docLabel} als versendet markiert` });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with status */}
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <h3 className="text-sm font-semibold text-foreground">Vorschau</h3>
        <Badge variant="outline" className={statusInfo.className}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pb-3">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGeneratePreview}
          disabled={!invoiceId || generating || disabled}
        >
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
          Vorschau
        </Button>

        {pdfUrl && currentStatus === 'draft' && (
          <Button size="sm" variant="outline" onClick={handleApprove} className="text-green-700 border-green-500 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950">
            <CheckCircle className="h-4 w-4 mr-1" />
            Freigeben
          </Button>
        )}

        {pdfUrl && (currentStatus === 'approved' || currentStatus === 'sent') && (
          <Button size="sm" variant="outline" onClick={() => setSendDialogOpen(true)}>
            <Send className="h-4 w-4 mr-1" />
            Versenden
          </Button>
        )}

        {pdfUrl && (
          <>
            <Button size="sm" variant="ghost" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* PDF viewer or placeholder */}
      <div className="flex-1 min-h-0">
        {pdfUrl ? (
          <PdfViewer url={pdfUrl} compact className="h-full" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg text-center p-6">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {invoiceId
                ? 'Klicken Sie auf "Vorschau", um das PDF zu generieren'
                : 'Speichern Sie zuerst das Dokument'}
            </p>
          </div>
        )}
      </div>

      {/* Send dialog */}
      <SendDocumentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        invoiceNumber={invoiceNumber}
        documentType={documentType}
        customerEmail={customerEmail || ''}
        pdfUrl={pdfUrl || ''}
        onSent={handleSendComplete}
      />
    </div>
  );
}
