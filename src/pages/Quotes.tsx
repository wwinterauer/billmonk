import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Plus, MoreHorizontal, CheckCircle, Send, Trash2, ArrowRight, Copy, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvoices, type Invoice } from '@/hooks/useInvoices';
import { useToast } from '@/hooks/use-toast';
import { PdfPreviewDialog } from '@/components/invoices/PdfPreviewDialog';
import { supabase } from '@/integrations/supabase/client';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  approved: { label: 'Freigegeben', variant: 'outline' },
  sent: { label: 'Versendet', variant: 'default' },
  accepted: { label: 'Angenommen', variant: 'outline' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' },
  expired: { label: 'Abgelaufen', variant: 'secondary' },
};

const Quotes = () => {
  const { invoices, loading, updateInvoiceStatus, deleteInvoice, copyInvoice, convertDocument } = useInvoices();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pdfPreview, setPdfPreview] = useState<{ open: boolean; path: string | null; number: string }>({ open: false, path: null, number: '' });
  const navigate = useNavigate();

  // Filter only quotes
  const quotes = useMemo(() => {
    return invoices.filter(inv => (inv as any).document_type === 'quote');
  }, [invoices]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return quotes;
    return quotes.filter(inv => inv.status === statusFilter);
  }, [quotes, statusFilter]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

  const fmtDate = (d: string | null) => {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('de-AT');
  };

  const customerName = (inv: Invoice) => {
    const c = inv.customers as any;
    return c?.display_name || c?.company_name || '–';
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="invoiceModule">
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Angebote</h1>
              <p className="text-muted-foreground">Angebote erstellen und in Aufträge oder Rechnungen umwandeln</p>
            </div>
            <Button asChild>
              <Link to="/invoices/new?type=quote">
                <Plus className="h-4 w-4 mr-2" />
                Neues Angebot
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Alle Angebote</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="approved">Freigegeben</SelectItem>
                  <SelectItem value="sent">Versendet</SelectItem>
                  <SelectItem value="accepted">Angenommen</SelectItem>
                  <SelectItem value="rejected">Abgelehnt</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-8">Laden…</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Keine Angebote vorhanden</p>
                  <Button asChild variant="outline">
                    <Link to="/invoices/new?type=quote">Erstes Angebot erstellen</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Gültig bis</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(inv => {
                      const sc = STATUS_CONFIG[inv.status || 'draft'] || STATUS_CONFIG.draft;
                      return (
                        <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{customerName(inv)}</TableCell>
                          <TableCell>{fmtDate(inv.invoice_date)}</TableCell>
                          <TableCell>{fmtDate(inv.due_date)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(inv.total || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => convertDocument(inv.id, 'order_confirmation')}>
                                  <ArrowRight className="h-4 w-4 mr-2" /> In Auftragsbestätigung
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => convertDocument(inv.id, 'delivery_note')}>
                                  <ArrowRight className="h-4 w-4 mr-2" /> In Lieferschein
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => convertDocument(inv.id, 'invoice')}>
                                  <ArrowRight className="h-4 w-4 mr-2" /> In Rechnung umwandeln
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInvoice(inv.id)}>
                                  <Copy className="h-4 w-4 mr-2" /> Kopieren
                                </DropdownMenuItem>
                                {inv.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'sent')}>
                                    <Send className="h-4 w-4 mr-2" /> Als versendet markieren
                                  </DropdownMenuItem>
                                )}
                                {inv.status === 'sent' && (
                                  <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'accepted')}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Als angenommen markieren
                                  </DropdownMenuItem>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" /> Löschen
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Angebot löschen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Das Angebot {inv.invoice_number} wird unwiderruflich gelöscht.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteInvoice(inv.id)}>Löschen</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Quotes;
