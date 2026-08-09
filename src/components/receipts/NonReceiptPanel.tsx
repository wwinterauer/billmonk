import { useCallback, useEffect, useState } from 'react';
import { FileQuestion, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface NonReceiptRow {
  id: string;
  file_name: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}

interface NonReceiptPanelProps {
  /** Called after a document was forced back into the receipt flow or discarded. */
  onChanged?: () => void;
}

/**
 * Documents the AI classified as "not a receipt" (contracts, court orders,
 * medical referrals, booking overviews). They stay visible and actionable here
 * instead of clogging the review queue.
 */
export function NonReceiptPanel({ onChanged }: NonReceiptPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<NonReceiptRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('receipts')
      .select('id, file_name, description, notes, created_at')
      .eq('user_id', user.id)
      .eq('status', 'not_a_receipt')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const forceAsReceipt = async (id: string) => {
    setBusyId(id);
    try {
      await supabase.from('receipts').update({ status: 'processing', notes: null }).eq('id', id);
      const { error } = await supabase.functions.invoke('extract-receipt', {
        body: { receiptId: id, forceTreatAsReceipt: true },
      });
      if (error) throw error;
      toast({ title: 'Als Rechnung verarbeitet', description: 'Der Beleg liegt jetzt in der Review.' });
      await load();
      onChanged?.();
    } catch (err) {
      await supabase.from('receipts').update({ status: 'not_a_receipt' }).eq('id', id);
      toast({
        variant: 'destructive',
        title: 'Fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from('receipts').update({ status: 'rejected' }).eq('id', id);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Fehlgeschlagen', description: error.message });
      return;
    }
    toast({ title: 'Verworfen', description: 'Das Dokument wurde archiviert.' });
    await load();
    onChanged?.();
  };

  if (rows.length === 0) return null;

  return (
    <Card className="mb-6 p-4">
      <div className="flex items-center gap-3">
        <FileQuestion className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {rows.length} {rows.length === 1 ? 'Dokument' : 'Dokumente'} ohne Rechnungscharakter
          </p>
          <p className="text-xs text-muted-foreground">
            Von der KI als Nicht-Beleg erkannt (z. B. Verträge, Bestätigungen). Sie blockieren die Review nicht.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Ausblenden' : 'Anzeigen'}
        </Button>
      </div>

      {expanded && (
        <ul className="mt-4 space-y-2">
          {rows.map(row => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.file_name ?? 'Unbenanntes Dokument'}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {row.description ?? row.notes ?? 'Kein Rechnungsdokument'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => forceAsReceipt(row.id)}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Doch als Rechnung
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === row.id}
                  onClick={() => discard(row.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Verwerfen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
