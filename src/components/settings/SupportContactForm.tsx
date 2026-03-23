import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MessageSquare, Send, Loader2, HelpCircle, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

export function SupportContactForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');

  const { data: tickets, refetch } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: faqs } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleSubmit = async () => {
    if (!user || !subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        user_email: user.email || '',
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      setSubject('');
      setMessage('');
      refetch();
      toast({ title: 'Nachricht gesendet', description: 'Wir melden uns so schnell wie möglich.' });
    } catch {
      toast({ title: 'Fehler', description: 'Nachricht konnte nicht gesendet werden.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    open: { label: 'Offen', variant: 'secondary' },
    replied: { label: 'Beantwortet', variant: 'default' },
    closed: { label: 'Geschlossen', variant: 'outline' },
  };

  // Filter FAQs by search term
  const searchLower = faqSearch.toLowerCase().trim();
  const filteredFaqs = searchLower
    ? (faqs || []).filter(
        (f: any) =>
          f.question.toLowerCase().includes(searchLower) ||
          f.answer.toLowerCase().includes(searchLower) ||
          (f.category && f.category.toLowerCase().includes(searchLower))
      )
    : (faqs || []);

  // Group FAQs by category
  const groupedFaqs: Record<string, any[]> = {};
  for (const faq of filteredFaqs) {
    const cat = (faq as any).category || 'Allgemein';
    if (!groupedFaqs[cat]) groupedFaqs[cat] = [];
    groupedFaqs[cat].push(faq);
  }

  return (
    <div className="space-y-6">
      {/* FAQ Section */}
      {faqs && faqs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Häufig gestellte Fragen
            </CardTitle>
            <CardDescription>Finde schnell Antworten auf deine Fragen</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="FAQs durchsuchen..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredFaqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine FAQs gefunden für &quot;{faqSearch}&quot;
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedFaqs).map(([category, items]) => (
                  <div key={category}>
                    {Object.keys(groupedFaqs).length > 1 && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </p>
                    )}
                    <Accordion type="multiple" className="space-y-1">
                      {items.map((faq: any) => (
                        <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-3">
                          <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap pb-3">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Kontakt & Support
          </CardTitle>
          <CardDescription>Keine Antwort gefunden? Schreib uns direkt!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-subject">Betreff</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Worum geht es?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">Nachricht</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Beschreibe dein Anliegen..."
              rows={5}
            />
          </div>
          <Button onClick={handleSubmit} disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Nachricht senden
          </Button>
        </CardContent>
      </Card>

      {/* Previous Tickets */}
      {tickets && tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deine Anfragen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tickets.map((ticket: any) => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                return (
                  <div key={ticket.id} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{ticket.subject}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{ticket.message}</p>
                    {ticket.admin_reply && (
                      <div className="mt-2 p-2 rounded bg-muted text-sm">
                        <p className="text-xs font-medium text-primary mb-1">Antwort vom Support:</p>
                        {ticket.admin_reply}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
