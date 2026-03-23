import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan: string | null;
  created_at: string | null;
  monthly_receipt_count: number | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  newsletter_opt_in: boolean | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users');
      if (error) throw error;
      setUsers(data?.users || []);
    } catch (err: any) {
      toast.error('Fehler beim Laden der Benutzer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || 
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.last_name || '').toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || (u.plan || 'free') === planFilter;
    return matchSearch && matchPlan;
  });

  const exportCSV = () => {
    const headers = ['E-Mail', 'Vorname', 'Nachname', 'Plan', 'Registriert', 'Belege', 'Stripe', 'Newsletter'];
    const rows = filteredUsers.map(u => [
      u.email,
      u.first_name || '',
      u.last_name || '',
      u.plan || 'free',
      u.created_at ? format(new Date(u.created_at), 'dd.MM.yyyy') : '',
      String(u.monthly_receipt_count || 0),
      u.stripe_customer_id ? 'Ja' : 'Nein',
      u.newsletter_opt_in ? 'Ja' : 'Nein',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benutzer-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateUserPlan = async (userId: string, newPlan: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update_plan', userId, plan: newPlan }
      });
      if (error) throw error;
      toast.success('Plan aktualisiert');
      fetchUsers();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const planColor = (plan: string | null) => {
    switch (plan) {
      case 'business': return 'default';
      case 'pro': return 'default';
      case 'starter': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Benutzer ({filteredUsers.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name oder E-Mail..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Pläne</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead>Belege</TableHead>
                    <TableHead>Stripe</TableHead>
                    <TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.email}</TableCell>
                      <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={planColor(u.plan)}>{u.plan || 'free'}</Badge>
                      </TableCell>
                      <TableCell>{u.created_at ? format(new Date(u.created_at), 'dd.MM.yyyy') : '—'}</TableCell>
                      <TableCell>{u.monthly_receipt_count || 0}</TableCell>
                      <TableCell>
                        {u.stripe_customer_id ? (
                          <Badge variant="outline" className="text-green-600">Aktiv</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.plan || 'free'}
                          onValueChange={v => updateUserPlan(u.id, v)}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
