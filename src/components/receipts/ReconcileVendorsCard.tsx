import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface ReconcileVendorsCardProps {
  unlinkedCount: number;
  onDone?: () => void | Promise<void>;
  onToggleFilter?: () => void;
  filterActive?: boolean;
}

export function ReconcileVendorsCard({ unlinkedCount, onDone, onToggleFilter, filterActive }: ReconcileVendorsCardProps) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  if (unlinkedCount === 0 && !filterActive) return null;


  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-vendors', { body: {} });
      if (error) throw error;
      const linked = data?.linked ?? 0;
      const approved = data?.approved ?? 0;
      toast({
        title: 'Abgleich abgeschlossen',
        description:
          linked === 0 && approved === 0
            ? 'Keine weiteren Belege konnten zugeordnet werden.'
            : `${linked} Beleg(e) zugeordnet, ${approved} automatisch freigegeben.`,
      });
      await onDone?.();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Abgleich fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
      <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {unlinkedCount} {unlinkedCount === 1 ? 'Beleg ohne' : 'Belege ohne'} Lieferantenzuordnung
        </p>
        <p className="text-xs text-muted-foreground">
          Ohne Zuordnung greift die automatische Freigabe nicht. Der Abgleich prüft Firmenname, rechtliche
          Namen und Markennamen erneut und gibt passende Belege frei.
        </p>
      </div>
      <div className="flex gap-2">
        {onToggleFilter && (
          <Button size="sm" variant={filterActive ? 'secondary' : 'outline'} onClick={onToggleFilter}>
            {filterActive ? 'Filter aufheben' : 'Anzeigen'}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={running} onClick={run}>
          {running ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          {running ? 'Gleiche ab...' : 'Lieferanten neu zuordnen'}
        </Button>
      </div>
    </div>
  );
}

