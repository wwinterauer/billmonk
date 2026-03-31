import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Play, Plus, ArrowLeft, Eye, Trophy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FieldAccuracy {
  field_name: string;
  version_a_correct: number;
  version_a_total: number;
  version_b_correct: number;
  version_b_total: number;
}

interface TestItem {
  id: string;
  receipt_id: string;
  original_data: Record<string, any>;
  result_a: Record<string, any> | null;
  result_b: Record<string, any> | null;
  field_scores: Record<string, { a: boolean | null; b: boolean | null }> | null;
}

const FIELD_LABELS: Record<string, string> = {
  vendor_name: 'Lieferant',
  total_amount: 'Betrag',
  tax_rate: 'MwSt-Satz',
  tax_amount: 'MwSt-Betrag',
  category: 'Kategorie',
  receipt_date: 'Datum',
  payment_method: 'Zahlungsart',
};

// Map original_data field names to V1/V2 AI output field names
const V1_FIELD_MAP: Record<string, string> = {
  vendor_name: 'vendor',
  total_amount: 'amount_gross',
  tax_rate: 'vat_rate',
  tax_amount: 'vat_amount',
  category: 'category',
  receipt_date: 'receipt_date',
  payment_method: 'payment_method',
};

const V2_FIELD_MAP: Record<string, string> = {
  vendor_name: 'vendor_name',
  total_amount: 'total_amount',
  tax_rate: 'tax_rate',
  tax_amount: 'tax_amount',
  category: 'category',
  receipt_date: 'receipt_date',
  payment_method: 'payment_method',
};

export function ABTestManager() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<TestItem | null>(null);

  // Fetch test runs
  const { data: testRuns, isLoading } = useQuery({
    queryKey: ['ab-test-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ab_test_runs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch field accuracy for selected run
  const { data: fieldAccuracy } = useQuery({
    queryKey: ['ab-test-accuracy', selectedRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ab_test_field_accuracy')
        .select('*')
        .eq('test_run_id', selectedRunId!);
      if (error) throw error;
      return data as FieldAccuracy[];
    },
    enabled: !!selectedRunId,
  });

  // Fetch items for selected run
  const { data: testItems } = useQuery({
    queryKey: ['ab-test-items', selectedRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ab_test_items')
        .select('*')
        .eq('test_run_id', selectedRunId!);
      if (error) throw error;
      return data as TestItem[];
    },
    enabled: !!selectedRunId,
  });

  // Count approved receipts
  const { data: approvedCount } = useQuery({
    queryKey: ['approved-receipt-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      return count || 0;
    },
  });

  // Create new test
  const createTest = useMutation({
    mutationFn: async () => {
      // Fetch approved receipts (limit 50)
      const { data: receipts, error: rErr } = await supabase
        .from('receipts')
        .select('id, vendor_name, amount_gross, vat_rate, vat_amount, category, receipt_date, payment_method')
        .eq('status', 'approved')
        .limit(50);

      if (rErr) throw rErr;
      if (!receipts || receipts.length === 0) throw new Error('Keine approved Belege gefunden');

      // Create test run
      const { data: { session } } = await supabase.auth.getSession();
      const { data: run, error: runErr } = await supabase
        .from('ab_test_runs')
        .insert({
          name: `Test ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
          description: `${receipts.length} Belege, V1 vs V2`,
          prompt_version_a: 'v1',
          prompt_version_b: 'v2',
          status: 'pending',
          created_by: session?.user?.id,
        })
        .select()
        .single();

      if (runErr || !run) throw runErr;

      // Create test items
      const items = receipts.map(r => ({
        test_run_id: run.id,
        receipt_id: r.id,
        original_data: {
          vendor_name: r.vendor_name,
          total_amount: r.amount_gross,
          tax_rate: r.vat_rate,
          tax_amount: r.vat_amount,
          category: r.category,
          receipt_date: r.receipt_date,
          payment_method: r.payment_method,
        },
      }));

      const { error: itemsErr } = await supabase.from('ab_test_items').insert(items);
      if (itemsErr) throw itemsErr;

      return run;
    },
    onSuccess: () => {
      toast.success('Test erstellt');
      queryClient.invalidateQueries({ queryKey: ['ab-test-runs'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Start test
  const startTest = useMutation({
    mutationFn: async (runId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('run-ab-test', {
        body: { test_run_id: runId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Test abgeschlossen!');
      queryClient.invalidateQueries({ queryKey: ['ab-test-runs'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test-accuracy'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test-items'] });
    },
    onError: (err: any) => toast.error(`Test fehlgeschlagen: ${err.message}`),
  });

  const selectedRun = testRuns?.find(r => r.id === selectedRunId);
  const summary = selectedRun?.results_summary as Record<string, any> | null;

  // ── Detail View ────────────────────────────────────────────────────
  if (selectedRunId && selectedRun) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedRunId(null); setDetailItem(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedRun.name}</span>
              <Badge variant={selectedRun.status === 'completed' ? 'default' : 'secondary'}>
                {selectedRun.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          {summary && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{summary.total_items}</div>
                  <div className="text-xs text-muted-foreground">Belege</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{summary.processed}</div>
                  <div className="text-xs text-muted-foreground">Verarbeitet</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <div className="text-2xl font-bold text-blue-600">{summary.overall_accuracy_a}%</div>
                  <div className="text-xs text-muted-foreground">V1 Accuracy</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600">{summary.overall_accuracy_b}%</div>
                  <div className="text-xs text-muted-foreground">V2 Accuracy</div>
                </div>
              </div>

              {/* Field accuracy table */}
              {fieldAccuracy && fieldAccuracy.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feld</TableHead>
                      <TableHead className="text-center">V1 Korrekt</TableHead>
                      <TableHead className="text-center">V1 %</TableHead>
                      <TableHead className="text-center">V2 Korrekt</TableHead>
                      <TableHead className="text-center">V2 %</TableHead>
                      <TableHead className="text-center">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldAccuracy.map(fa => {
                      const pctA = fa.version_a_total > 0 ? Math.round((fa.version_a_correct / fa.version_a_total) * 100) : 0;
                      const pctB = fa.version_b_total > 0 ? Math.round((fa.version_b_correct / fa.version_b_total) * 100) : 0;
                      const winner = pctA > pctB ? 'V1' : pctB > pctA ? 'V2' : 'Gleich';
                      return (
                        <TableRow key={fa.field_name}>
                          <TableCell className="font-medium">{FIELD_LABELS[fa.field_name] || fa.field_name}</TableCell>
                          <TableCell className="text-center">{fa.version_a_correct}/{fa.version_a_total}</TableCell>
                          <TableCell className="text-center font-mono">{pctA}%</TableCell>
                          <TableCell className="text-center">{fa.version_b_correct}/{fa.version_b_total}</TableCell>
                          <TableCell className="text-center font-mono">{pctB}%</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={winner === 'V2' ? 'default' : winner === 'V1' ? 'secondary' : 'outline'}>
                              {winner === 'Gleich' ? '=' : winner} {winner !== 'Gleich' && <Trophy className="h-3 w-3 ml-1" />}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {/* Items list */}
              {testItems && testItems.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Einzelne Belege</h3>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {testItems.map(item => {
                      const scores = item.field_scores || {};
                      const aCorrect = Object.values(scores).filter(s => s.a === true).length;
                      const bCorrect = Object.values(scores).filter(s => s.b === true).length;
                      const total = Object.values(scores).filter(s => s.a !== null || s.b !== null).length;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer text-sm"
                          onClick={() => setDetailItem(item)}
                        >
                          <span className="truncate max-w-[200px]">
                            {(item.original_data as any)?.vendor_name || item.receipt_id?.slice(0, 8)}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-blue-600 font-mono">{aCorrect}/{total}</span>
                            <span className="text-green-600 font-mono">{bCorrect}/{total}</span>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Detail comparison dialog */}
        <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vergleich: {(detailItem?.original_data as any)?.vendor_name || 'Beleg'}</DialogTitle>
            </DialogHeader>
            {detailItem && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feld</TableHead>
                    <TableHead>Original (Approved)</TableHead>
                    <TableHead>V1 Ergebnis</TableHead>
                    <TableHead>V2 Ergebnis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(FIELD_LABELS).map(field => {
                    const orig = (detailItem.original_data as any)?.[field];
                    const v1Val = detailItem.result_a?.[V1_FIELD_MAP[field] || field];
                    const v2Val = detailItem.result_b?.[V2_FIELD_MAP[field] || field];
                    const scores = detailItem.field_scores?.[field];
                    return (
                      <TableRow key={field}>
                        <TableCell className="font-medium">{FIELD_LABELS[field]}</TableCell>
                        <TableCell>{orig ?? '—'}</TableCell>
                        <TableCell className={scores?.a === true ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : scores?.a === false ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' : ''}>
                          {v1Val ?? '—'}
                        </TableCell>
                        <TableCell className={scores?.b === true ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : scores?.b === false ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' : ''}>
                          {v2Val ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Overview ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">A/B Tests — Prompt V1 vs V2</h2>
          <p className="text-sm text-muted-foreground">
            {approvedCount} approved Belege verfügbar (max. 50 pro Test)
          </p>
        </div>
        <Button
          onClick={() => createTest.mutate()}
          disabled={createTest.isPending || !approvedCount}
        >
          {createTest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Neuen Test erstellen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !testRuns?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Noch keine Tests erstellt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {testRuns.map(run => {
            const s = run.results_summary as Record<string, any> | null;
            return (
              <Card key={run.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => run.status === 'completed' && setSelectedRunId(run.id)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium">{run.name}</div>
                    <div className="text-sm text-muted-foreground">{run.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(run.created_at), 'dd.MM.yyyy HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s && (
                      <div className="text-right text-sm">
                        <div className="text-blue-600 font-mono">V1: {s.overall_accuracy_a}%</div>
                        <div className="text-green-600 font-mono">V2: {s.overall_accuracy_b}%</div>
                      </div>
                    )}
                    <Badge variant={
                      run.status === 'completed' ? 'default' :
                      run.status === 'running' ? 'secondary' : 'outline'
                    }>
                      {run.status === 'completed' ? 'Fertig' : run.status === 'running' ? 'Läuft...' : 'Wartend'}
                    </Badge>
                    {run.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); startTest.mutate(run.id); }}
                        disabled={startTest.isPending}
                      >
                        {startTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
