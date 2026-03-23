import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Upload, CreditCard, XCircle, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityEvent {
  id: string;
  event_type: string;
  user_id: string;
  user_email: string;
  details: Record<string, any>;
  created_at: string;
}

interface ActivityFeedProps {
  data: ActivityEvent[] | null;
  loading: boolean;
}

const eventConfig: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  registration: { label: 'Registrierung', icon: UserPlus, color: 'text-green-500' },
  upload: { label: 'Upload', icon: Upload, color: 'text-blue-500' },
  plan_change: { label: 'Plan-Änderung', icon: CreditCard, color: 'text-primary' },
  cancellation: { label: 'Kündigung', icon: XCircle, color: 'text-destructive' },
};

export function ActivityFeed({ data, loading }: ActivityFeedProps) {
  const [filter, setFilter] = useState<string>('all');

  if (loading) {
    return <div className="text-muted-foreground text-sm">Lade Aktivitäts-Feed...</div>;
  }

  const events = data || [];
  const filtered = filter === 'all' ? events : events.filter((e) => e.event_type === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Alle Events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Events</SelectItem>
            <SelectItem value="registration">Registrierungen</SelectItem>
            <SelectItem value="upload">Uploads</SelectItem>
            <SelectItem value="plan_change">Plan-Änderungen</SelectItem>
            <SelectItem value="cancellation">Kündigungen</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} Events</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitäts-Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Aktivitäten gefunden.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((event) => {
                const config = eventConfig[event.event_type] || {
                  label: event.event_type,
                  icon: Activity,
                  color: 'text-muted-foreground',
                };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {event.user_email || 'Unbekannt'}
                        {event.details?.plan && ` — Plan: ${event.details.plan}`}
                        {event.details?.old_plan && event.details?.new_plan && ` — ${event.details.old_plan} → ${event.details.new_plan}`}
                        {event.details?.file_name && ` — ${event.details.file_name}`}
                        {event.details?.source && event.details.source !== 'upload' && ` (${event.details.source})`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
