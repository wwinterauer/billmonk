import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNewsletters, type NewsletterRecipient } from '@/hooks/useNewsletters';
import { cn } from '@/lib/utils';

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
  draft: {
    label: 'Entwurf',
    className: 'bg-muted text-muted-foreground border-border',
    Icon: Clock,
  },
};

type FilterMode = 'all' | 'failed' | 'sent';

export default function NewsletterStatus() {
  const { newsletters, loading, fetchRecipients } = useNewsletters();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const [expandedId, setExpandedId] = useState<string | null>(initialId);
  const [recipients, setRecipients] = useState<NewsletterRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-load + scroll to ?id=
  useEffect(() => {
    if (!initialId || loading) return;
    const exists = newsletters.some((n) => n.id === initialId);
    if (!exists) return;
    setExpandedId(initialId);
    loadRecipients(initialId);
    setTimeout(() => {
      itemRefs.current[initialId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [initialId, loading, newsletters.length]);

  const loadRecipients = async (id: string) => {
    setLoadingRecipients(true);
    const data = await fetchRecipients(id);
    setRecipients(data);
    setLoadingRecipients(false);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('id');
      setSearchParams(next, { replace: true });
      return;
    }
    setExpandedId(id);
    setRecipients([]);
    setFilterMode('all');
    loadRecipients(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  const stats = useMemo(() => {
    const total = newsletters.length;
    const sent = newsletters.filter((n) => n.status === 'sent').length;
    const failed = newsletters.filter((n) => n.status === 'failed').length;
    const totalRecipients = newsletters.reduce((s, n) => s + (n.total_recipients || 0), 0);
    const totalSent = newsletters.reduce((s, n) => s + (n.sent_count || 0), 0);
    const successRate = totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 0;
    return { total, sent, failed, totalRecipients, totalSent, successRate };
  }, [newsletters]);

  const visibleNewsletters = useMemo(() => {
    const term = search.trim().toLowerCase();
    return newsletters
      .filter((n) => n.status !== 'draft')
      .filter((n) => (term ? n.subject.toLowerCase().includes(term) : true));
  }, [newsletters, search]);

  const filteredRecipients = useMemo(() => {
    if (filterMode === 'failed') return recipients.filter((r) => r.status === 'failed');
    if (filterMode === 'sent') return recipients.filter((r) => r.status === 'sent');
    return recipients;
  }, [recipients, filterMode]);

  return (
    <DashboardLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Newsletter-Status
            </h1>
            <p className="text-sm text-muted-foreground">
              Übersicht aller Versände, Empfänger und Fehlerdetails
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Newsletter gesamt" value={stats.total} loading={loading} />
          <StatCard
            label="Erfolgreich"
            value={stats.sent}
            loading={loading}
            tone="success"
          />
          <StatCard
            label="Fehlgeschlagen"
            value={stats.failed}
            loading={loading}
            tone="danger"
          />
          <StatCard
            label="Zustellrate"
            value={`${stats.successRate}%`}
            sublabel={`${stats.totalSent} / ${stats.totalRecipients}`}
            loading={loading}
          />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nach Betreff suchen..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Versandprotokoll</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : visibleNewsletters.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {search ? 'Keine Newsletter gefunden.' : 'Noch kein Newsletter versendet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleNewsletters.map((nl) => {
                  const cfg = STATUS_BADGE[nl.status] ?? STATUS_BADGE.draft;
                  const StatusIcon = cfg.Icon;
                  const isExpanded = expandedId === nl.id;
                  const dateValue = nl.sent_at || nl.created_at;
                  return (
                    <div
                      key={nl.id}
                      ref={(el) => (itemRefs.current[nl.id] = el)}
                      className={cn(
                        'border rounded-lg transition-colors',
                        isExpanded ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(nl.id)}
                        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors rounded-lg"
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground truncate">{nl.subject}</span>
                            <Badge variant="outline" className={cfg.className}>
                              <StatusIcon
                                className={cn(
                                  'h-3 w-3 mr-1',
                                  nl.status === 'sending' && 'animate-spin',
                                )}
                              />
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {dateValue && (
                              <span>
                                {format(new Date(dateValue), 'dd.MM.yyyy HH:mm', { locale: de })}
                              </span>
                            )}
                            <span>
                              <span className="font-mono text-foreground">{nl.sent_count ?? 0}</span>
                              {' / '}
                              <span className="font-mono">{nl.total_recipients ?? 0}</span>
                              {' versendet'}
                            </span>
                            {(nl.failed_count ?? 0) > 0 && (
                              <span className="text-red-600 font-medium">
                                · {nl.failed_count} fehlgeschlagen
                              </span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/50 p-4 space-y-3">
                          <Tabs
                            value={filterMode}
                            onValueChange={(v) => setFilterMode(v as FilterMode)}
                          >
                            <TabsList>
                              <TabsTrigger value="all">
                                Alle ({recipients.length})
                              </TabsTrigger>
                              <TabsTrigger value="failed">
                                Fehler ({recipients.filter((r) => r.status === 'failed').length})
                              </TabsTrigger>
                              <TabsTrigger value="sent">
                                Erfolgreich ({recipients.filter((r) => r.status === 'sent').length})
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>

                          {loadingRecipients ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                              ))}
                            </div>
                          ) : filteredRecipients.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Keine Empfänger in dieser Auswahl.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                              {filteredRecipients.map((r) => (
                                <RecipientRow key={r.id} recipient={r} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  loading,
  tone,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  loading?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p
            className={cn(
              'text-2xl font-bold',
              tone === 'success' && 'text-green-600',
              tone === 'danger' && 'text-red-600',
              !tone && 'text-foreground',
            )}
          >
            {value}
          </p>
        )}
        {sublabel && <p className="text-xs text-muted-foreground mt-1 font-mono">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function RecipientRow({ recipient }: { recipient: NewsletterRecipient }) {
  const isFailed = recipient.status === 'failed';
  const isSent = recipient.status === 'sent';
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isFailed && 'border-red-500/30 bg-red-500/5',
        isSent && 'border-border/50 bg-muted/20',
        !isFailed && !isSent && 'border-border/50',
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {recipient.name && (
            <p className="text-sm font-medium text-foreground truncate">{recipient.name}</p>
          )}
          <p className="text-xs font-mono text-muted-foreground truncate">{recipient.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSent && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {isFailed && <AlertCircle className="h-4 w-4 text-red-600" />}
          {!isFailed && !isSent && <Clock className="h-4 w-4 text-muted-foreground" />}
          {recipient.sent_at && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(recipient.sent_at), 'dd.MM. HH:mm', { locale: de })}
            </span>
          )}
        </div>
      </div>
      {isFailed && recipient.error_message && (
        <p className="mt-2 text-xs text-red-600 break-words leading-relaxed">
          {recipient.error_message}
        </p>
      )}
    </div>
  );
}
