import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TestSendDialog } from '@/components/newsletter/TestSendDialog';

interface LastNewsletter {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string | null;
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  sent: {
    label: 'Erfolgreich',
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Fehlgeschlagen',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    Icon: AlertCircle,
  },
  sending: {
    label: 'Versand läuft',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    Icon: Loader2,
  },
};

export function LastNewsletterCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [newsletter, setNewsletter] = useState<LastNewsletter | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('newsletters')
        .select('id, subject, status, sent_at, created_at, total_recipients, sent_count, failed_count')
        .eq('user_id', user.id)
        .neq('status', 'draft')
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setNewsletter((data as LastNewsletter) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          Letzter Newsletter
        </CardTitle>
        <Link to="/newsletter-status">
          <Button variant="ghost" size="sm">
            Alle
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !newsletter ? (
          <div className="py-6 text-center">
            <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Noch kein Newsletter versendet
            </p>
            <Link to="/settings?tab=newsletter">
              <Button size="sm" variant="outline">Newsletter erstellen</Button>
            </Link>
          </div>
        ) : (
          <NewsletterContent newsletter={newsletter} />
        )}
      </CardContent>
    </Card>
  );
}

function NewsletterContent({ newsletter }: { newsletter: LastNewsletter }) {
  const statusConfig = STATUS_BADGE[newsletter.status] ?? {
    label: newsletter.status,
    className: 'bg-muted text-muted-foreground border-border',
    Icon: Mail,
  };
  const StatusIcon = statusConfig.Icon;
  const dateValue = newsletter.sent_at || newsletter.created_at;
  const total = newsletter.total_recipients ?? 0;
  const sent = newsletter.sent_count ?? 0;
  const failed = newsletter.failed_count ?? 0;
  const detailsHref = `/newsletter-status?id=${newsletter.id}`;

  return (
    <div className="space-y-3">
      <Link
        to={detailsHref}
        className="block font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
        title={newsletter.subject}
      >
        {newsletter.subject}
      </Link>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={statusConfig.className}>
          <StatusIcon className={`h-3 w-3 mr-1 ${newsletter.status === 'sending' ? 'animate-spin' : ''}`} />
          {statusConfig.label}
        </Badge>
        {dateValue && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(dateValue), 'dd.MM.yyyy HH:mm', { locale: de })}
          </span>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <span className="font-mono text-foreground">{sent}</span>
        {' / '}
        <span className="font-mono">{total}</span>
        {' versendet'}
        {failed > 0 && (
          <span className="ml-2 text-red-600 font-medium">
            · {failed} fehlgeschlagen
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <TestSendDialog
          newsletterId={newsletter.id}
          newsletterSubject={newsletter.subject}
          trigger={
            <Button variant="outline" size="sm" className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Testversand
            </Button>
          }
        />
        {failed > 0 ? (
          <Link to={detailsHref}>
            <Button variant="outline" size="sm" className="w-full">
              <AlertCircle className="h-4 w-4 mr-2" />
              Fehlerdetails anzeigen
            </Button>
          </Link>
        ) : (
          <Link to={detailsHref}>
            <Button variant="ghost" size="sm" className="w-full">
              Details ansehen
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
