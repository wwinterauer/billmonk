import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Repeat, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { RecurringGroup } from '@/lib/recurring-detection';

interface Props {
  groups: RecurringGroup[];
  dismissedKeys: Set<string>;
  onDismiss: (key: string) => void;
  onIgnoreAll: (group: RecurringGroup) => Promise<void> | void;
  isBusy?: boolean;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

const cadenceLabel = (c: RecurringGroup['cadence']) =>
  c === 'monthly' ? 'monatlich' : c === 'quarterly' ? 'quartalsweise' : 'unregelmäßig';

export function RecurringSuggestionsPanel({ groups, dismissedKeys, onDismiss, onIgnoreAll, isBusy }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmGroup, setConfirmGroup] = useState<RecurringGroup | null>(null);

  const visible = groups.filter(g => !dismissedKeys.has(g.key));
  if (visible.length === 0) return null;

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold">Wiederkehrende Akontobuchungen erkannt</h3>
            <Badge variant="secondary">{visible.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Diese Buchungen wiederholen sich mit identischem Betrag (z.B. monatliche
            Akontozahlungen für Strom oder Heizung). Solche Zwischenabbuchungen haben
            i.d.R. keinen Einzelbeleg – nur die Endabrechnung. Du kannst sie hier
            gesammelt als „ignoriert" markieren.
          </p>

          <div className="space-y-2">
            {visible.map(g => {
              const isOpen = expanded.has(g.key);
              return (
                <div key={g.key} className="rounded-md border bg-background">
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{g.vendorLabel}</span>
                        <span className="font-mono text-sm">{fmtEur(g.amount)}</span>
                        <Badge variant="outline" className="text-xs">{cadenceLabel(g.cadence)}</Badge>
                        {g.confidence === 'medium' && (
                          <Badge variant="outline" className="text-[10px] border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                            wahrscheinlich
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.count} Buchungen · Ø {g.avgIntervalDays} Tage ·{' '}
                        {format(new Date(g.firstDate), 'dd.MM.yyyy', { locale: de })} –{' '}
                        {format(new Date(g.lastDate), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => toggle(g.key)}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isOpen ? 'Ausblenden' : 'Anzeigen'}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isBusy}
                        onClick={() => setConfirmGroup(g)}
                      >
                        Alle als Akonto ignorieren
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismiss(g.key)}
                        className="text-muted-foreground"
                        title="Vorschlag verwerfen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-1 max-h-64 overflow-y-auto">
                      {g.transactions.map(t => (
                        <div key={t.id} className="flex items-start gap-3 text-xs">
                          <span className="font-mono shrink-0 w-20">
                            {t.transaction_date
                              ? format(new Date(t.transaction_date), 'dd.MM.yyyy', { locale: de })
                              : '–'}
                          </span>
                          <span className="font-mono shrink-0 w-20 text-right">{fmtEur(Math.abs(t.amount ?? 0))}</span>
                          <span className="flex-1 break-words whitespace-pre-wrap text-muted-foreground">
                            {t.description || '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmGroup} onOpenChange={(o) => !o && setConfirmGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Akontobuchungen ignorieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmGroup && (
                <>
                  {confirmGroup.count} Buchungen von <strong>{confirmGroup.vendorLabel}</strong>{' '}
                  über je {fmtEur(confirmGroup.amount)} werden als <strong>ignoriert</strong>{' '}
                  markiert und nicht mehr für den Belegabgleich berücksichtigt. Du kannst dies
                  unter „Ignoriert" jederzeit rückgängig machen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmGroup) {
                  await onIgnoreAll(confirmGroup);
                  setConfirmGroup(null);
                }
              }}
            >
              Ignorieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
