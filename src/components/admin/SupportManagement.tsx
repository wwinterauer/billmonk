import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

export function SupportManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredTickets = filter === 'all'
    ? (tickets || [])
    : (tickets || []).filter((t: any) => t.status === filter);

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_reply: replyText.trim(),
          status: 'replied',
          replied_at: new Date().toISOString(),
          replied_by: user.id,
        })
        .eq('id', ticketId);
      if (error) throw error;
      setReplyingTo(null);
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast({ title: 'Antwort gesendet' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleClose = async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
  };

  const handleDelete = async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticketId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    open: { label: 'Offen', variant: 'secondary' },
    replied: { label: 'Beantwortet', variant: 'default' },
    closed: { label: 'Geschlossen', variant: 'outline' },
  };

  const openCount = (tickets || []).filter((t: any) => t.status === 'open').length;

  if (isLoading) return <div className="text-sm text-muted-foreground">Lade Support-Tickets...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tickets</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="replied">Beantwortet</SelectItem>
            <SelectItem value="closed">Geschlossen</SelectItem>
          </SelectContent>
        </Select>
        {openCount > 0 && (
          <Badge variant="destructive">{openCount} offen</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Support-Anfragen ({filteredTickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Tickets gefunden.</p>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket: any) => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                return (
                  <div key={ticket.id} className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{ticket.subject}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          von {ticket.user_email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm">{ticket.message}</p>

                    {ticket.admin_reply && (
                      <div className="p-2 rounded bg-muted text-sm">
                        <p className="text-xs font-medium text-primary mb-1">Deine Antwort:</p>
                        {ticket.admin_reply}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {ticket.status === 'open' && (
                        <>
                          {replyingTo === ticket.id ? (
                            <div className="flex-1 space-y-2">
                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Antwort schreiben..."
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleReply(ticket.id)} disabled={sending || !replyText.trim()}>
                                  {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                  Senden
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                                  Abbrechen
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setReplyingTo(ticket.id)}>
                              Antworten
                            </Button>
                          )}
                        </>
                      )}
                      {ticket.status !== 'closed' && (
                        <Button size="sm" variant="outline" onClick={() => handleClose(ticket.id)}>
                          Schließen
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(ticket.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
