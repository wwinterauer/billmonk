import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Subscriber {
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan: string | null;
  newsletter_opt_in: boolean | null;
  created_at: string | null;
}

export function NewsletterManagement() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [allUsers, setAllUsers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('admin-users');
        if (error) throw error;
        const users: Subscriber[] = data?.users || [];
        setAllUsers(users);
        setSubscribers(users.filter(u => u.newsletter_opt_in));
      } catch {
        toast.error('Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const exportCSV = (onlyOptIn: boolean) => {
    const list = onlyOptIn ? subscribers : allUsers;
    const headers = ['E-Mail', 'Vorname', 'Nachname', 'Plan', 'Newsletter'];
    const rows = list.map(u => [
      u.email,
      u.first_name || '',
      u.last_name || '',
      u.plan || 'free',
      u.newsletter_opt_in ? 'Ja' : 'Nein',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-${onlyOptIn ? 'abonnenten' : 'alle'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Newsletter-Abonnenten</span>
            </div>
            <p className="text-2xl font-bold">{subscribers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Opt-in-Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {allUsers.length > 0 ? ((subscribers.length / allUsers.length) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Newsletter-Liste</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV(true)}>
                <Download className="h-4 w-4 mr-2" />
                Abonnenten CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(false)}>
                <Download className="h-4 w-4 mr-2" />
                Alle Nutzer CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Exportiere die Liste als CSV und importiere sie in Mailchimp oder ein anderes Newsletter-Tool.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Newsletter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map(u => (
                <TableRow key={u.email}>
                  <TableCell className="font-mono text-sm">{u.email}</TableCell>
                  <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.plan || 'free'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-500">Opt-in</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {subscribers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Noch keine Newsletter-Abonnenten
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
