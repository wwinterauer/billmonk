import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, CheckCircle2, AlertTriangle, Copy, XCircle, Loader2, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { describeReason, eventsToCsv, hintForReason, type UploadEventRow } from '@/lib/uploadReasons';
import { cn } from '@/lib/utils';

interface UploadRunOverviewProps {
  userId: string;
  activeRunId: string | null;
  isActive: boolean;
  onRunClosed?: () => void;
}

interface RunRow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  expected_count: number | null;
}

type EventRow = UploadEventRow & { run_id: string };

type BucketKey = 'uploaded' | 'duplicate' | 'rejected' | 'failed' | 'pending';

const BUCKET_ORDER: BucketKey[] = ['uploaded', 'duplicate', 'rejected', 'failed', 'pending'];

const BUCKET_META: Record<BucketKey, { label: string; icon: typeof CheckCircle2; className: string }> = {
  uploaded: { label: 'hochgeladen', icon: CheckCircle2, className: 'text-emerald-600' },
  duplicate: { label: 'Duplikat übersprungen', icon: Copy, className: 'text-amber-600' },
  rejected: { label: 'nicht nutzbar', icon: AlertTriangle, className: 'text-orange-600' },
  failed: { label: 'fehlgeschlagen', icon: XCircle, className: 'text-destructive' },
  pending: { label: 'offen / in Bearbeitung', icon: Loader2, className: 'text-muted-foreground' },
};

const STALL_THRESHOLD_MS = 2 * 60 * 1000;
const dayKeyOf = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

function bucketize(events: EventRow[]) {
  const result: Record<BucketKey, EventRow[]> = {
    uploaded: [], duplicate: [], rejected: [], failed: [], pending: [],
  };
  for (const event of events) {
    const key = (event.outcome ?? 'pending') as BucketKey;
    (result[key] ?? result.pending).push(event);
  }
  return result;
}

function downloadCsv(rows: UploadEventRow[], name: string) {
  const blob = new Blob([eventsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function UploadRunOverview({ userId, activeRunId, isActive, onRunClosed }: UploadRunOverviewProps) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [closingRunId, setClosingRunId] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('upload_runs')
      .select('id, status, started_at, completed_at, expected_count')
      .eq('user_id', userId)
      .gte('started_at', since)
      .order('started_at', { ascending: false });
    if (data) setRuns(data as RunRow[]);
  }, [userId]);

  useEffect(() => { loadRuns(); }, [loadRuns, activeRunId]);

  const days = useMemo(() => {
    const map = new Map<string, RunRow[]>();
    for (const run of runs) {
      const key = dayKeyOf(run.started_at);
      const list = map.get(key);
      if (list) list.push(run); else map.set(key, [run]);
    }
    return map;
  }, [runs]);

  const dayKeys = useMemo(() => Array.from(days.keys()), [days]);

  useEffect(() => {
    if (dayKeys.length === 0) return;
    setSelectedDay(prev => (prev && dayKeys.includes(prev) ? prev : dayKeys[0]));
  }, [dayKeys]);

  const dayRuns = useMemo(() => (selectedDay ? days.get(selectedDay) ?? [] : []), [days, selectedDay]);

  const loadEvents = useCallback(async () => {
    if (dayRuns.length === 0) { setEvents([]); return; }
    const { data } = await supabase
      .from('upload_file_events')
      .select('id, run_id, file_name, file_size, mime_type, phase, outcome, reason_code, error_message, updated_at')
      .in('run_id', dayRuns.map(r => r.id))
      .eq('user_id', userId)
      .order('ordinal', { ascending: true });
    if (data) setEvents(data as EventRow[]);
  }, [dayRuns, userId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const dayHasActiveRun = dayRuns.some(r => r.status === 'active');

  useEffect(() => {
    if (!isActive && !dayHasActiveRun) return;
    const interval = setInterval(() => { loadEvents(); loadRuns(); }, 3000);
    return () => clearInterval(interval);
  }, [isActive, dayHasActiveRun, loadEvents, loadRuns]);

  useEffect(() => {
    if (activeRunId) setOpenRunId(activeRunId);
    else if (dayRuns.length > 0) setOpenRunId(prev => prev ?? dayRuns[0].id);
  }, [activeRunId, dayRuns]);

  const eventsByRun = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const event of events) {
      const list = map.get(event.run_id);
      if (list) list.push(event); else map.set(event.run_id, [event]);
    }
    return map;
  }, [events]);

  const dayBuckets = useMemo(() => bucketize(events), [events]);
  const dayTotal = events.length;

  const closeRun = async (run: RunRow, runEvents: EventRow[]) => {
    setClosingRunId(run.id);
    const buckets = bucketize(runEvents);
    await supabase
      .from('upload_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        uploaded_count: buckets.uploaded.length,
        duplicate_count: buckets.duplicate.length,
        rejected_count: buckets.rejected.length,
        failed_count: buckets.failed.length,
        pending_count: buckets.pending.length,
      })
      .eq('id', run.id);
    setClosingRunId(null);
    await loadRuns();
    onRunClosed?.();
  };

  if (dayTotal === 0 && dayRuns.length === 0) return null;

  const dayLabel = selectedDay
    ? isToday(new Date(`${selectedDay}T12:00:00`))
      ? `Heute, ${format(new Date(`${selectedDay}T12:00:00`), 'd. MMMM yyyy', { locale: de })}`
      : format(new Date(`${selectedDay}T12:00:00`), 'EEEE, d. MMMM yyyy', { locale: de })
    : '';

  return (
    <Card className="mb-6 border-primary/20">
      <CardContent className="p-5 space-y-4">
        {/* Day summary */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {dayLabel} · {dayRuns.length} {dayRuns.length === 1 ? 'Sitzung' : 'Sitzungen'}
            </p>
            <p className="text-lg font-semibold">{dayTotal} Dateien reingezogen</p>
          </div>
          <div className="flex items-center gap-2">
            {dayKeys.length > 1 && (
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={selectedDay ?? ''}
                onChange={e => { setSelectedDay(e.target.value); setOpenRunId(null); }}
              >
                {dayKeys.map(key => (
                  <option key={key} value={key}>
                    {format(new Date(`${key}T12:00:00`), 'd. MMM yyyy', { locale: de })} ·{' '}
                    {(days.get(key) ?? []).reduce((sum, r) => sum + (r.expected_count ?? 0), 0)} Dateien
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => downloadCsv(events, `upload-protokoll-${selectedDay}.csv`)}>
              <Download className="h-4 w-4 mr-1" /> Tag als CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BUCKET_ORDER.map(key => {
            const meta = BUCKET_META[key];
            const Icon = meta.icon;
            return (
              <div key={key} className="rounded-md border p-2">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-4 w-4', meta.className)} />
                  <span className="text-lg font-semibold tabular-nums">{dayBuckets[key].length}</span>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">{meta.label}</p>
              </div>
            );
          })}
        </div>

        {/* Sessions */}
        <div className="space-y-2">
          {dayRuns.map(run => {
            const runEvents = eventsByRun.get(run.id) ?? [];
            const buckets = bucketize(runEvents);
            const total = runEvents.length;
            const done = total - buckets.pending.length;
            const lastActivity = runEvents.reduce(
              (max, e) => Math.max(max, new Date(e.updated_at).getTime()), 0,
            );
            const runIsLive = isActive && run.id === activeRunId;
            const stalled =
              run.status === 'active' && !runIsLive && buckets.pending.length > 0 &&
              Date.now() - lastActivity > STALL_THRESHOLD_MS;
            const isOpen = openRunId === run.id;

            return (
              <div key={run.id} className="rounded-lg border">
                <button
                  type="button"
                  className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  onClick={() => setOpenRunId(isOpen ? null : run.id)}
                >
                  <span className="font-medium">{format(new Date(run.started_at), 'HH:mm', { locale: de })} Uhr</span>
                  <span className="text-muted-foreground">{total} Dateien</span>
                  {runIsLive ? (
                    <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> läuft</Badge>
                  ) : stalled ? (
                    <Badge variant="destructive" className="gap-1"><PauseCircle className="h-3 w-3" /> abgebrochen</Badge>
                  ) : (
                    <Badge variant="outline">abgeschlossen</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{done} von {total} verarbeitet</span>
                  <ChevronDown className={cn('h-4 w-4 ml-auto transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="border-t p-3 space-y-3">
                    <Progress value={total ? (done / total) * 100 : 0} className="h-2" />

                    <div className="space-y-1">
                      {BUCKET_ORDER.map(key => {
                        const rows = buckets[key];
                        if (rows.length === 0) return null;
                        const meta = BUCKET_META[key];
                        const Icon = meta.icon;
                        const bucketId = `${run.id}:${key}`;
                        const bucketOpen = openBucket === bucketId;
                        return (
                          <div key={key} className="rounded-md border">
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                              onClick={() => setOpenBucket(bucketOpen ? null : bucketId)}
                            >
                              <Icon className={cn('h-4 w-4', meta.className)} />
                              <span className="font-medium tabular-nums w-10 text-right">{rows.length}</span>
                              <span className="text-muted-foreground">{meta.label}</span>
                              <ChevronDown className={cn('h-4 w-4 ml-auto transition-transform', bucketOpen && 'rotate-180')} />
                            </button>
                            {bucketOpen && (
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

                    {stalled && buckets.pending.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {buckets.pending.filter(e => e.phase === 'selected' || e.phase === 'duplicate-check').length} Dateien
                        wurden nie fertig verarbeitet. Zieh sie einfach erneut rein — bereits verarbeitete Belege werden
                        automatisch als Duplikat erkannt.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCsv(runEvents, `upload-sitzung-${format(new Date(run.started_at), 'yyyy-MM-dd-HHmm')}.csv`)}
                      >
                        <Download className="h-4 w-4 mr-1" /> Sitzung als CSV
                      </Button>
                      {run.status === 'active' && !runIsLive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={closingRunId === run.id}
                          onClick={() => closeRun(run, runEvents)}
                        >
                          Lauf abschließen
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
