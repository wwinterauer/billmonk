import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Download, Search, Users, CheckCircle, XCircle, Eye } from 'lucide-react';
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
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  account_type: string | null;
  company_name: string | null;
  uid_number: string | null;
  onboarding_completed: boolean | null;
  subscription_end_date: string | null;
  stripe_product_id: string | null;
  avatar_url: string | null;
  receipt_credit: number | null;
  monthly_document_count: number | null;
  document_credit: number | null;
  admin_view_plan: string | null;
  total_receipts: number;
  total_receipt_amount: number;
  total_invoices: number;
  total_invoice_amount: number;
  open_tickets: number;
  stripe_revenue: number;
  stripe_payment_count: number;
  stripe_last_payment_at: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [onboardingFilter, setOnboardingFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

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
      (u.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || (u.plan || 'free') === planFilter;
    const matchSub = subFilter === 'all' ||
      (subFilter === 'none' && !u.subscription_status) ||
      u.subscription_status === subFilter;
    const matchType = typeFilter === 'all' ||
      (typeFilter === 'none' && !u.account_type) ||
      u.account_type === typeFilter;
    const matchOnb = onboardingFilter === 'all' ||
      (onboardingFilter === 'yes' && u.onboarding_completed) ||
      (onboardingFilter === 'no' && !u.onboarding_completed);
    return matchSearch && matchPlan && matchSub && matchType && matchOnb;
  });

  const exportCSV = () => {
    const headers = ['E-Mail', 'Vorname', 'Nachname', 'Kontotyp', 'Firma', 'Plan', 'Abo-Status', 'Registriert', 'Onboarding', 'Belege/Monat', 'Belege gesamt', 'Ausgaben', 'Rechnungen', 'Rechnungsumsatz', 'Abo-Umsatz', 'Zahlungen', 'Credits', 'Stripe', 'Newsletter'];
    const rows = filteredUsers.map(u => [
      u.email,
      u.first_name || '',
      u.last_name || '',
      u.account_type || '—',
      u.company_name || '',
      u.plan || 'free',
      u.subscription_status || '—',
      u.created_at ? format(new Date(u.created_at), 'dd.MM.yyyy') : '',
      u.onboarding_completed ? 'Ja' : 'Nein',
      String(u.monthly_receipt_count || 0),
      String(u.total_receipts),
      u.total_receipt_amount.toFixed(2),
      String(u.total_invoices),
      u.total_invoice_amount.toFixed(2),
      u.stripe_revenue.toFixed(2),
      String(u.stripe_payment_count),
      String(u.receipt_credit || 0),
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

  const planColor = (plan: string | null): "default" | "secondary" | "outline" | "destructive" => {
    switch (plan) {
      case 'business': case 'pro': return 'default';
      case 'starter': return 'secondary';
      default: return 'outline';
    }
  };

  const subBadge = (status: string | null) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Aktiv</Badge>;
      case 'trialing': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Trial</Badge>;
      case 'canceled': return <Badge variant="destructive">Gekündigt</Badge>;
      default: return <span className="text-muted-foreground text-sm">—</span>;
    }
  };

  const formatEur = (v: number) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(v);

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
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Suche nach Name, E-Mail, Firma..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Pläne</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Abos</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="canceled">Gekündigt</SelectItem>
                <SelectItem value="none">Keins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="private">Privat</SelectItem>
                <SelectItem value="company">Firma</SelectItem>
                <SelectItem value="association">Verein</SelectItem>
                <SelectItem value="none">Nicht gesetzt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={onboardingFilter} onValueChange={setOnboardingFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Onboarding</SelectItem>
                <SelectItem value="yes">Abgeschlossen</SelectItem>
                <SelectItem value="no">Offen</SelectItem>
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
                    <TableHead>Typ</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Abo</TableHead>
                    <TableHead>Onb.</TableHead>
                     <TableHead className="text-right">Belege</TableHead>
                     <TableHead className="text-right">Ausgaben</TableHead>
                     <TableHead className="text-right">Abo-Umsatz</TableHead>
                     <TableHead>Registriert</TableHead>
                     <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">{u.email}</TableCell>
                      <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell className="text-sm">{u.account_type === 'company' ? 'Firma' : u.account_type === 'private' ? 'Privat' : u.account_type === 'association' ? 'Verein' : '—'}</TableCell>
                      <TableCell><Badge variant={planColor(u.plan)}>{u.plan || 'free'}</Badge></TableCell>
                      <TableCell>{subBadge(u.subscription_status)}</TableCell>
                      <TableCell>{u.onboarding_completed ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                      <TableCell className="text-right">{u.total_receipts}</TableCell>
                      <TableCell className="text-right text-sm">{formatEur(u.total_receipt_amount)}</TableCell>
                      <TableCell className="text-sm">{u.created_at ? format(new Date(u.created_at), 'dd.MM.yyyy') : '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setSelectedUser(u); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserDetailDialog user={selectedUser} onClose={() => setSelectedUser(null)} onUpdatePlan={updateUserPlan} />
    </div>
  );
}

function UserDetailDialog({ user, onClose, onUpdatePlan }: { user: UserData | null; onClose: () => void; onUpdatePlan: (id: string, plan: string) => void }) {
  if (!user) return null;

  const formatEur = (v: number) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(v);
  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('').toUpperCase() || user.email[0].toUpperCase();

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] break-all">{value || '—'}</span>
    </div>
  );

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</div>
              <div className="text-sm font-normal text-muted-foreground">{user.email}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Persönliche Daten */}
          <section>
            <h4 className="text-sm font-semibold mb-1">Persönliche Daten</h4>
            <Separator className="mb-2" />
            <InfoRow label="Telefon" value={user.phone} />
            <InfoRow label="Adresse" value={[user.street, [user.zip, user.city].filter(Boolean).join(' '), user.country].filter(Boolean).join(', ') || null} />
          </section>

          {/* Unternehmen */}
          <section>
            <h4 className="text-sm font-semibold mb-1">Unternehmen</h4>
            <Separator className="mb-2" />
            <InfoRow label="Kontotyp" value={user.account_type === 'company' ? 'Firma' : user.account_type === 'private' ? 'Privat' : user.account_type === 'association' ? 'Verein' : null} />
            <InfoRow label="Firmenname" value={user.company_name} />
            <InfoRow label="UID-Nummer" value={user.uid_number} />
          </section>

          {/* Abonnement */}
          <section>
            <h4 className="text-sm font-semibold mb-1">Abonnement</h4>
            <Separator className="mb-2" />
            <div className="flex justify-between py-1.5 items-center">
              <span className="text-muted-foreground text-sm">Plan</span>
              <Select value={user.plan || 'free'} onValueChange={v => onUpdatePlan(user.id, v)}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <InfoRow label="Abo-Status" value={user.subscription_status || 'Keins'} />
            <InfoRow label="Stripe-ID" value={user.stripe_customer_id} />
            <InfoRow label="Produkt-ID" value={user.stripe_product_id} />
            <InfoRow label="Abo-Ende" value={user.subscription_end_date ? format(new Date(user.subscription_end_date), 'dd.MM.yyyy') : null} />
          </section>

          {/* Nutzung */}
          <section>
            <h4 className="text-sm font-semibold mb-1">Nutzung</h4>
            <Separator className="mb-2" />
            <InfoRow label="Belege diesen Monat" value={user.monthly_receipt_count || 0} />
            <InfoRow label="Belege gesamt" value={user.total_receipts} />
            <InfoRow label="Beleg-Credits" value={user.receipt_credit || 0} />
            <InfoRow label="Ausgaben gesamt" value={formatEur(user.total_receipt_amount)} />
            <InfoRow label="Rechnungen gesamt" value={user.total_invoices} />
            <InfoRow label="Rechnungsumsatz" value={formatEur(user.total_invoice_amount)} />
            <InfoRow label="Dokumente/Monat" value={user.monthly_document_count || 0} />
            <InfoRow label="Dokument-Credits" value={user.document_credit || 0} />
          </section>

          {/* Sonstiges */}
          <section>
            <h4 className="text-sm font-semibold mb-1">Sonstiges</h4>
            <Separator className="mb-2" />
            <InfoRow label="Registriert am" value={user.created_at ? format(new Date(user.created_at), 'dd.MM.yyyy HH:mm') : null} />
            <InfoRow label="Onboarding" value={user.onboarding_completed ? 'Abgeschlossen' : 'Offen'} />
            <InfoRow label="Newsletter" value={user.newsletter_opt_in ? 'Ja' : 'Nein'} />
            <InfoRow label="Offene Tickets" value={user.open_tickets > 0 ? <Badge variant="destructive">{user.open_tickets}</Badge> : '0'} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
