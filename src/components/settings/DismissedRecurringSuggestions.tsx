import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRecurringDismissals } from '@/hooks/useRecurringDismissals';
import { format } from 'date-fns';

export function DismissedRecurringSuggestions() {
  const { dismissals, restore } = useRecurringDismissals();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abgelehnte Vorschläge</CardTitle>
        <CardDescription>Wiederkehrende Buchungen, deren Vorschlag im Kontoabgleich weggeklickt wurde.</CardDescription>
      </CardHeader>
      <CardContent>
        {dismissals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine abgelehnten Vorschläge.</p>
        ) : (
          <ul className="divide-y">
            {dismissals.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.label || d.pattern_key}</div>
                  <div className="text-xs text-muted-foreground">abgelehnt am {format(new Date(d.created_at), 'dd.MM.yyyy')}</div>
                </div>
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(d.id)}>
                  Wieder aktivieren
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
