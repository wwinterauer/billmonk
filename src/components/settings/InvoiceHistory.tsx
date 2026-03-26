import { useState, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface StripeInvoice {
  id: string;
  date: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open';
  invoice_pdf: string | null;
}

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-invoices');
        if (fnError) throw fnError;
        setInvoices(data?.invoices || []);
      } catch (err: any) {
        setError(err?.message || 'Rechnungen konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Rechnungen
        </CardTitle>
        <CardDescription>Deine bisherigen Zahlungen und Rechnungen</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Noch keine Rechnungen vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="whitespace-nowrap">
                      {inv.date
                        ? format(new Date(inv.date), 'dd. MMM yyyy', { locale: de })
                        : '–'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{inv.plan_name}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {inv.amount.toLocaleString('de-AT', {
                        style: 'currency',
                        currency: inv.currency,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>
                        {inv.status === 'paid' ? 'Bezahlt' : 'Offen'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.invoice_pdf ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
