import { useState } from 'react';
import { Clock, CheckCircle, XCircle, Mail, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNewsletters, type NewsletterRecipient } from '@/hooks/useNewsletters';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function NewsletterHistory() {
  const { newsletters, loading, deleteNewsletter, fetchRecipients } = useNewsletters();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<NewsletterRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingRecipients(true);
    const data = await fetchRecipients(id);
    setRecipients(data);
    setLoadingRecipients(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Gesendet</Badge>;
      case 'sending': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Wird gesendet</Badge>;
      case 'failed': return <Badge className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="h-3 w-3 mr-1" />Fehlgeschlagen</Badge>;
      default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Entwurf</Badge>;
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Versandhistorie</CardTitle>
            <CardDescription>Übersicht aller versendeten Newsletter</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {newsletters.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Noch keine Newsletter versendet</p>
        ) : (
          <div className="space-y-3">
            {newsletters.map(nl => (
              <div key={nl.id} className="border rounded-lg">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleExpand(nl.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{nl.subject}</span>
                      {getStatusBadge(nl.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {nl.sent_at && <span>{format(new Date(nl.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>}
                      <span>{nl.sent_count}/{nl.total_recipients} gesendet</span>
                      {nl.failed_count > 0 && <span className="text-destructive">{nl.failed_count} fehlgeschlagen</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(nl.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {expandedId === nl.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedId === nl.id && (
                  <div className="border-t p-3 bg-muted/30">
                    {loadingRecipients ? (
                      <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : recipients.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">Keine Empfänger-Details verfügbar</p>
                    ) : (
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {recipients.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-sm py-1">
                            <span className="truncate">{r.name || r.email}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.email}</span>
                              {r.status === 'sent' ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                              ) : r.status === 'failed' ? (
                                <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Newsletter löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Der Newsletter und alle Empfänger-Daten werden gelöscht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={async () => { if (deleteId) { await deleteNewsletter(deleteId); setDeleteId(null); } }}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
