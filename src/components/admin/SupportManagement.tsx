import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Loader2, Trash2, Bug, Lightbulb, CheckCircle2, XCircle, Gift } from 'lucide-react';
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [rewardingId, setRewardingId] = useState<string | null>(null);

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

  const filteredTickets = (tickets || [])
    .filter((t: any) => filter === 'all' || t.status === filter)
    .filter((t: any) => typeFilter === 'all' || t.ticket_type === typeFilter);

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

  const handleReward = async (ticketId: string, action: 'approve' | 'reject') => {
    setRewardingId(ticketId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('reward-support-credit', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { ticketId, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast({
        title: action === 'approve' ? 'Anerkannt' : 'Abgelehnt',
        description: data?.message || (action === 'approve' ? 'Gutschrift wurde angewendet' : 'Ticket wurde abgelehnt'),
      });
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setRewardingId(null);
    }
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
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="replied">Beantwortet</SelectItem>
            <SelectItem value="closed">Geschlossen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
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
                const canReward = !ticket.reward_status && (ticket.status === 'open' || ticket.status === 'replied');
                return (
                  <div key={ticket.id} className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{ticket.subject}</span>
                        <span className="text-xs text-muted-foreground">von {ticket.user_email}</span>
                        {ticket.ticket_type === 'bug' && (
                          <Badge variant="outline" className="text-xs gap-1 border-red-300 text-red-600">
                            <Bug className="h-3 w-3" /> Bug
                          </Badge>
                        )}
                        {ticket.ticket_type === 'feature' && (
                          <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-600">
                            <Lightbulb className="h-3 w-3" /> Feature
                          </Badge>
                        )}
                        {ticket.area && (
                          <Badge variant="secondary" className="text-xs">{ticket.area}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {ticket.reward_status === 'approved' && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                            <Gift className="h-3 w-3" /> Gutschrift
                          </Badge>
                        )}
                        {ticket.reward_status === 'rejected' && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Abgelehnt</Badge>
                        )}
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {ticket.status === 'open' && (
                        <>
                          {replyingTo === ticket.id ? (
                            <div className="flex-1 space-y-2 w-full">
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

                      {/* Reward buttons */}
                      {canReward && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => handleReward(ticket.id, 'approve')}
                            disabled={rewardingId === ticket.id}
                          >
                            {rewardingId === ticket.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Anerkennen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-muted-foreground"
                            onClick={() => handleReward(ticket.id, 'reject')}
                            disabled={rewardingId === ticket.id}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Ablehnen
                          </Button>
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
