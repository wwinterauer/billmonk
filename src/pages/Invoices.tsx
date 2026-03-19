import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Plus, MoreHorizontal, CheckCircle, Send, XCircle, Trash2, Euro, Clock, AlertTriangle, Download, Copy, GitBranch, ArrowRight, Receipt, Landmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvoices, type Invoice } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaxExportDialog } from '@/components/exports/TaxExportDialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  sent: { label: 'Versendet', variant: 'default' },
  paid: { label: 'Bezahlt', variant: 'outline' },
  overdue: { label: 'Überfällig', variant: 'destructive' },
  cancelled: { label: 'Storniert', variant: 'secondary' },
  credited: { label: 'Gutgeschrieben', variant: 'secondary' },
  corrected: { label: 'Korrigiert', variant: 'secondary' },
};

const Invoices = () => {
  const { invoices, loading, updateInvoiceStatus, deleteInvoice, copyInvoice, createCorrectionVersion, convertDocument, createPartialInvoice } = useInvoices();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taxExportOpen, setTaxExportOpen] = useState(false);
  const navigate = useNavigate();

  // Filter only invoices (not quotes/order_confirmations)
  const invoiceOnly = useMemo(() => {
    return invoices.filter(inv => !(inv as any).document_type || (inv as any).document_type === 'invoice');
  }, [invoices]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return invoiceOnly;
    return invoiceOnly.filter(inv => inv.status === statusFilter);
  }, [invoiceOnly, statusFilter]);

  const stats = useMemo(() => {
    const open = invoiceOnly.filter(i => i.status === 'sent').reduce((s, i) => s + (i.total || 0), 0);
    const overdue = invoiceOnly.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total || 0), 0);
    const paidThisMonth = invoiceOnly
      .filter(i => {
        if (i.status !== 'paid' || !i.paid_at) return false;
        const d = new Date(i.paid_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, i) => s + (i.total || 0), 0);
    return { open, overdue, paidThisMonth };
  }, [invoiceOnly]);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rechnungen</h1>
            <p className="text-muted-foreground">Ausgangsrechnungen erstellen und verwalten</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTaxExportOpen(true)}>
              <Landmark className="h-4 w-4 mr-2" />
              Steuerberater-Export
            </Button>
            <Button asChild>
              <Link to="/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                Neue Rechnung
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Offen</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(stats.open)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Überfällig</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{fmt(stats.overdue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bezahlt (Monat)</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(stats.paidThisMonth)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter + Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alle Rechnungen</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="sent">Versendet</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Laden…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Keine Rechnungen vorhanden</p>
                <Button asChild variant="outline">
                  <Link to="/invoices/new">Erste Rechnung erstellen</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => {
                    const sc = STATUS_CONFIG[inv.status || 'draft'] || STATUS_CONFIG.draft;
                    const hasVersion = !!(inv as any).version;
                    return (
                        <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                          <TableCell className="font-medium">
                            {inv.invoice_number}
                            {hasVersion && <Badge variant="outline" className="ml-1 text-[10px]">{(inv as any).version}</Badge>}
                            {(inv as any).invoice_subtype && (inv as any).invoice_subtype !== 'normal' && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">
                                {{ deposit: 'Anzahlung', partial: 'Teilzahlung', final: 'Schlussrechnung' }[(inv as any).invoice_subtype] || ''}
                              </Badge>
                            )}
                          </TableCell>
                        <TableCell>{customerName(inv)}</TableCell>
                        <TableCell>{fmtDate(inv.invoice_date)}</TableCell>
                        <TableCell>{fmtDate(inv.due_date)}</TableCell>
                        <TableCell>
                          {(inv as any).category ? (
                            <Badge variant="outline" className="text-xs">{(inv as any).category}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(inv.total || 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                            {inv.paid_at && inv.status === 'paid' && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Bezahlt am {new Date(inv.paid_at).toLocaleDateString('de-AT')}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                              <DropdownMenuItem onClick={async () => {
                                toast({ title: 'PDF wird erstellt…' });
                                const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
                                  body: { invoice_id: inv.id },
                                });
                                if (error) {
                                  toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden', variant: 'destructive' });
                                } else {
                                  toast({ title: 'PDF erstellt', description: 'Das PDF wurde generiert.' });
                                }
                              }}>
                                <Download className="h-4 w-4 mr-2" /> PDF generieren
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyInvoice(inv.id)}>
                                <Copy className="h-4 w-4 mr-2" /> Kopieren
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => createCorrectionVersion(inv.id)}>
                                <GitBranch className="h-4 w-4 mr-2" /> Korrektur erstellen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => convertDocument(inv.id, 'delivery_note')}>
                                <ArrowRight className="h-4 w-4 mr-2" /> In Lieferschein
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'deposit')}>
                                <Receipt className="h-4 w-4 mr-2" /> Anzahlungsrechnung
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'partial')}>
                                <Receipt className="h-4 w-4 mr-2" /> Teilrechnung
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'final')}>
                                <Receipt className="h-4 w-4 mr-2" /> Schlussrechnung
                              </DropdownMenuItem>
                              {inv.status === 'draft' && (
                                <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'sent')}>
                                  <Send className="h-4 w-4 mr-2" /> Als versendet markieren
                                </DropdownMenuItem>
                              )}
                              {(inv.status === 'sent' || inv.status === 'overdue') && (
                                <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'paid')}>
                                  <CheckCircle className="h-4 w-4 mr-2" /> Als bezahlt markieren
                                </DropdownMenuItem>
                              )}
                              {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'cancelled')}>
                                  <XCircle className="h-4 w-4 mr-2" /> Stornieren
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
                                    <AlertDialogTitle>Rechnung löschen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Die Rechnung {inv.invoice_number} wird unwiderruflich gelöscht.
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

      {/* Tax Export Dialog */}
      <TaxExportDialog
        open={taxExportOpen}
        onOpenChange={setTaxExportOpen}
        defaultBookingType="income"
      />
    </DashboardLayout>
  );
};

export default Invoices;
