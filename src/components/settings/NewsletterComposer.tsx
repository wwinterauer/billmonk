import { useState } from 'react';
import { Send, Save, Loader2, Users, Building2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNewsletters } from '@/hooks/useNewsletters';
import { useCustomers } from '@/hooks/useCustomers';
import { useMembers } from '@/hooks/useMembers';
import { useMemberTypes } from '@/hooks/useMemberTypes';
import { useToast } from '@/hooks/use-toast';

export function NewsletterComposer() {
  const { createNewsletter, sendNewsletter } = useNewsletters();
  const { customers } = useCustomers();
  const { members } = useMembers();
  const { memberTypes } = useMemberTypes();
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipientType, setRecipientType] = useState('all');
  const [memberTypeFilter, setMemberTypeFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const getRecipientCount = () => {
    const customerRecipients = customers.filter(c => !c.is_archived && !c.newsletter_opt_out && c.email);
    const memberRecipients = members.filter(m => m.is_active !== false && !m.newsletter_opt_out && m.email);

    switch (recipientType) {
      case 'customers':
        return customerRecipients.length;
      case 'members':
        if (memberTypeFilter !== 'all') {
          return memberRecipients.filter(m => m.member_type === memberTypeFilter).length;
        }
        return memberRecipients.length;
      case 'all':
      default: {
        const allEmails = new Set([
          ...customerRecipients.map(c => c.email!.toLowerCase()),
          ...memberRecipients.map(m => m.email!.toLowerCase()),
        ]);
        return allEmails.size;
      }
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Bitte Betreff und Inhalt ausfüllen', variant: 'destructive' });
      return;
    }

    setSending(true);
    const filter: Record<string, unknown> = {};
    if (memberTypeFilter !== 'all') filter.member_type = memberTypeFilter;

    const newsletter = await createNewsletter(subject, content, recipientType, filter);
    if (newsletter) {
      const success = await sendNewsletter(newsletter.id);
      if (success) {
        setSubject('');
        setContent('');
        setRecipientType('all');
        setMemberTypeFilter('all');
      }
    }
    setSending(false);
    setConfirmOpen(false);
  };

  const recipientCount = getRecipientCount();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Newsletter erstellen</CardTitle>
            <CardDescription>Versende E-Mails an deine Kunden und Mitglieder</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient Selection */}
        <div className="space-y-3">
          <Label>Empfänger</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={recipientType} onValueChange={setRecipientType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kontakte</SelectItem>
                <SelectItem value="customers">Nur Kunden</SelectItem>
                <SelectItem value="members">Nur Mitglieder</SelectItem>
              </SelectContent>
            </Select>
            {recipientType === 'members' && (
              <Select value={memberTypeFilter} onValueChange={setMemberTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle Typen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {memberTypes.map(t => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge variant="secondary" className="h-9 px-3 flex items-center">
              {recipientCount} Empfänger
            </Badge>
          </div>
        </div>

        {/* Subject */}
        <div>
          <Label>Betreff</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Newsletter Betreff..." />
        </div>

        {/* Content */}
        <div>
          <Label>Inhalt (HTML möglich)</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
            placeholder="Schreibe hier deinen Newsletter-Text. HTML-Tags werden unterstützt..."
            className="font-mono text-sm"
          />
        </div>

        {/* Preview info */}
        <p className="text-xs text-muted-foreground">
          Hinweis: Der Newsletter wird an alle Kontakte versendet, die nicht abgemeldet sind und eine gültige E-Mail-Adresse haben.
          Ein Abmelde-Link wird automatisch angehängt.
        </p>

        {/* Send button */}
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!subject.trim() || !content.trim() || recipientCount === 0}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          Newsletter an {recipientCount} Empfänger senden
        </Button>
      </CardContent>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Newsletter versenden?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">Betreff: <strong>{subject}</strong></p>
            <p className="text-sm">Empfänger: <strong>{recipientCount}</strong></p>
            <p className="text-sm text-muted-foreground">Der Newsletter wird sofort an alle ausgewählten Empfänger versendet. Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Jetzt senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
