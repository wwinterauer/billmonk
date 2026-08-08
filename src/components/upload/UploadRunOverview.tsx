import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, CheckCircle2, AlertTriangle, Copy, XCircle, Loader2, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { describeReason, eventsToCsv, hintForReason, type UploadEventRow } from '@/lib/uploadReasons';
import { cn } from '@/lib/utils';

interface UploadRunOverviewProps {
  runId: string;
  userId: string;
  isActive: boolean;
  onRunClosed?: () => void;
}

type BucketKey = 'uploaded' | 'duplicate' | 'rejected' | 'failed' | 'pending';

const BUCKET_META: Record<BucketKey, { label: string; icon: typeof CheckCircle2; className: string }> = {
  uploaded: { label: 'hochgeladen', icon: CheckCircle2, className: 'text-emerald-600' },
  duplicate: { label: 'Duplikat übersprungen', icon: Copy, className: 'text-amber-600' },
  rejected: { label: 'nicht nutzbar', icon: AlertTriangle, className: 'text-orange-600' },
  failed: { label: 'fehlgeschlagen', icon: XCircle, className: 'text-destructive' },
  pending: { label: 'offen / in Bearbeitung', icon: Loader2, className: 'text-muted-foreground' },
};

const STALL_THRESHOLD_MS = 2 * 60 * 1000;

export function UploadRunOverview({ runId, userId, isActive, onRunClosed }: UploadRunOverviewProps) {
  const [events, setEvents] = useState<UploadEventRow[]>([]);
  const [runStatus, setRunStatus] = useState<string>('active');
  const [openBucket, setOpenBucket] = useState<BucketKey | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: eventRows }, { data: runRow }] = await Promise.all([
      supabase
        .from('upload_file_events')
        .select('id, file_name, file_size, mime_type, phase, outcome, reason_code, error_message, updated_at')
        .eq('run_id', runId)
        .eq('user_id', userId)
        .order('ordinal', { ascending: true }),
      supabase.from('upload_runs').select('status').eq('id', runId).maybeSingle(),
    ]);
    if (eventRows) setEvents(eventRows as UploadEventRow[]);
    if (runRow?.status) setRunStatus(runRow.status);
  }, [runId, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isActive && runStatus !== 'active') return;
    const interval = setInterval(() => { load(); }, 3000);
    return () => clearInterval(interval);
  }, [isActive, runStatus, load]);

  const buckets = useMemo(() => {
    const result: Record<BucketKey, UploadEventRow[]> = {
      uploaded: [], duplicate: [], rejected: [], failed: [], pending: [],
    };
    for (const event of events) {
      const key = (event.outcome ?? 'pending') as BucketKey;
      (result[key] ?? result.pending).push(event);
    }
    return result;
  }, [events]);

  const total = events.length;
  const done = total - buckets.pending.length;
  const lastActivity = useMemo(
    () => events.reduce((max, e) => Math.max(max, new Date(e.updated_at).getTime()), 0),
    [events],
  );
  const stalled =
    runStatus === 'active' && !isActive && buckets.pending.length > 0 &&
    Date.now() - lastActivity > STALL_THRESHOLD_MS;

  const notStarted = buckets.pending.filter(e => e.phase === 'selected');

  const handleCsv = () => {
    const blob = new Blob([eventsToCsv(events)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `upload-protokoll-${runId.slice(0, 8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = async () => {
    setClosing(true);
    await supabase
      .from('upload_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        uploaded_count: buckets.uploaded.length,
        duplicate_count: buckets.duplicate.length,
        rejected_count: buckets.rejected.length,
        failed_count: buckets.failed.length,
        pending_count: buckets.pending.length,
      })
      .eq('id', runId);
    setRunStatus('completed');
    setClosing(false);
    onRunClosed?.();
  };

  if (total === 0) return null;

  return (
    <Card className="mb-6 border-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{total} Dateien reingezogen</p>
            <p className="text-sm text-muted-foreground">
              {runStatus !== 'active'
                ? 'Lauf abgeschlossen'
                : stalled
                  ? `${done} von ${total} verarbeitet, Rest nicht gestartet — Tab wurde geschlossen oder neu geladen`
                  : buckets.pending.length > 0
                    ? `Upload läuft — ${done} von ${total} verarbeitet`
                    : 'Alle Dateien verarbeitet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stalled && (
              <Badge variant="destructive" className="gap-1">
                <PauseCircle className="h-3 w-3" /> abgebrochen
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleCsv}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            {runStatus === 'active' && !isActive && (
              <Button variant="secondary" size="sm" onClick={handleClose} disabled={closing}>
                Lauf abschließen
              </Button>
            )}
          </div>
        </div>

        <Progress value={total ? (done / total) * 100 : 0} className="h-2" />

        <div className="space-y-1">
          {(Object.keys(BUCKET_META) as BucketKey[]).map(key => {
            const rows = buckets[key];
            if (rows.length === 0) return null;
            const meta = BUCKET_META[key];
            const Icon = meta.icon;
            const isOpen = openBucket === key;
            return (
              <div key={key} className="rounded-md border">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  onClick={() => setOpenBucket(isOpen ? null : key)}
                >
                  <Icon className={cn('h-4 w-4', meta.className)} />
                  <span className="font-medium tabular-nums w-10 text-right">{rows.length}</span>
                  <span className="text-muted-foreground">{meta.label}</span>
                  <ChevronDown className={cn('h-4 w-4 ml-auto transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <ul className="max-h-64 overflow-y-auto border-t divide-y text-xs">
                    {rows.map(row => {
                      const hint = hintForReason(row.reason_code);
                      return (
                        <li key={row.id} className="px-3 py-2">
                          <p className="font-medium truncate">{row.file_name}</p>
                          <p className="text-muted-foreground">{describeReason(row)}</p>
                          {hint && <p className="text-muted-foreground/80 italic">{hint}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {stalled && notStarted.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {notStarted.length} Dateien wurden nie gestartet. Zieh sie einfach erneut rein — bereits
            verarbeitete Belege werden dabei automatisch als Duplikat erkannt.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
