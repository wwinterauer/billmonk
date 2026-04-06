import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Copy, Loader2, Pencil, Check, X, UserCheck, Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface BetaCode {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  created_at: string;
  expires_at: string | null;
  assigned_email: string | null;
}

interface BetaApplication {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  organization_type: string;
  organization_name: string | null;
  intended_plan: string;
  status: string;
  city: string | null;
  country: string | null;
  created_at: string;
}

export function BetaCodeManagement() {
  const [codes, setCodes] = useState<BetaCode[]>([]);
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editMaxUses, setEditMaxUses] = useState('');
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState('30');

  const fetchCodes = async () => {
    const { data } = await supabase
      .from('beta_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes((data as BetaCode[]) || []);
  };

  const fetchApplications = async () => {
    const { data } = await supabase
      .from('beta_applications')
      .select('*')
      .order('created_at', { ascending: false });
    setApplications((data as BetaApplication[]) || []);
  };

  useEffect(() => {
    Promise.all([fetchCodes(), fetchApplications()]).then(() => setLoading(false));
  }, []);

  const createCode = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('beta_codes').insert({
      code: newCode.trim().toUpperCase(),
      description: newDescription.trim() || null,
      max_uses: newMaxUses ? parseInt(newMaxUses) : null,
    });
    if (error) {
      toast.error(error.code === '23505' ? 'Code existiert bereits' : 'Fehler beim Erstellen');
    } else {
      toast.success('Beta-Code erstellt');
      setNewCode('');
      setNewDescription('');
      setNewMaxUses('');
      fetchCodes();
    }
    setCreating(false);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('beta_codes').update({ is_active: !currentActive }).eq('id', id);
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentActive } : c));
    toast.success(!currentActive ? 'Code aktiviert' : 'Code deaktiviert');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code kopiert');
  };

  const startEdit = (c: BetaCode) => {
    setEditingId(c.id);
    setEditDescription(c.description || '');
    setEditMaxUses(c.max_uses !== null ? String(c.max_uses) : '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('beta_codes').update({
      description: editDescription.trim() || null,
      max_uses: editMaxUses ? parseInt(editMaxUses) : null,
    }).eq('id', id);
    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Code aktualisiert');
      setEditingId(null);
      fetchCodes();
    }
    setSaving(false);
  };

  const approveApplication = async (app: BetaApplication) => {
    setApprovingId(app.id);
    try {
      const days = parseInt(durationDays) || 30;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const codeStr = `BETA-${app.first_name.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

      // Create beta code
      const { data: codeData, error: codeError } = await supabase.from('beta_codes').insert({
        code: codeStr,
        description: `Auto für ${app.first_name} ${app.last_name}`,
        max_uses: 1,
        expires_at: expiresAt,
        assigned_email: app.email,
        beta_application_id: app.id,
      } as any).select().single();

      if (codeError) throw codeError;

      // Update application status
      await supabase.from('beta_applications').update({
        status: 'approved',
        beta_code_id: (codeData as any).id,
      } as any).eq('id', app.id);

      // Send approval email
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            template: 'beta-approval',
            to: app.email,
            data: {
              name: app.first_name,
              beta_code: codeStr,
              expires_at: expiresAt,
              duration_days: days,
            },
          },
        });
        toast.success(`Freigabe-E-Mail an ${app.email} gesendet`);
      } catch {
        toast.success('Code erstellt (E-Mail konnte nicht gesendet werden)');
      }

      fetchCodes();
      fetchApplications();
    } catch (err) {
      toast.error('Fehler bei der Freigabe');
    } finally {
      setApprovingId(null);
    }
  };

  const rejectApplication = async (id: string) => {
    await supabase.from('beta_applications').update({ status: 'rejected' } as any).eq('id', id);
    toast.success('Bewerbung abgelehnt');
    fetchApplications();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const pendingApps = applications.filter(a => a.status === 'pending');
  const processedApps = applications.filter(a => a.status !== 'pending');

  return (
    <Tabs defaultValue="applications" className="space-y-6">
      <TabsList>
        <TabsTrigger value="applications" className="gap-2">
          <Mail className="h-4 w-4" />
          Bewerbungen
          {pendingApps.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingApps.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="codes">Beta-Codes</TabsTrigger>
      </TabsList>

      {/* ─── Applications Tab ─── */}
      <TabsContent value="applications" className="space-y-6">
        {/* Duration selector */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Zugangsdauer bei Freigabe:</span>
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 Tage</SelectItem>
                  <SelectItem value="30">30 Tage</SelectItem>
                  <SelectItem value="60">60 Tage</SelectItem>
                  <SelectItem value="90">90 Tage</SelectItem>
                  <SelectItem value="180">180 Tage</SelectItem>
                  <SelectItem value="365">1 Jahr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pending applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offene Bewerbungen ({pendingApps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApps.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Keine offenen Bewerbungen</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Ort</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApps.map(app => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.first_name} {app.last_name}</TableCell>
                        <TableCell className="text-sm">{app.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {app.organization_type}
                            {app.organization_name ? ` · ${app.organization_name}` : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{app.intended_plan}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{app.city || '–'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(app.created_at), 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => approveApplication(app)}
                              disabled={approvingId === app.id}
                            >
                              {approvingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                              Freigeben
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectApplication(app.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed applications */}
        {processedApps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bearbeitete Bewerbungen ({processedApps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedApps.map(app => (
                      <TableRow key={app.id}>
                        <TableCell>{app.first_name} {app.last_name}</TableCell>
                        <TableCell className="text-sm">{app.email}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs capitalize">{app.intended_plan}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={app.status === 'approved' ? 'default' : 'destructive'} className="text-xs">
                            {app.status === 'approved' ? 'Freigegeben' : 'Abgelehnt'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(app.created_at), 'dd.MM.yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ─── Codes Tab ─── */}
      <TabsContent value="codes" className="space-y-6">
        {/* Create new code */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Neuen Beta-Code erstellen</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Code (z.B. BETA2024)"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Input
                placeholder="Beschreibung (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
              <Input
                placeholder="Max. Nutzungen"
                type="number"
                value={newMaxUses}
                onChange={e => setNewMaxUses(e.target.value)}
                className="w-40"
              />
              <Button onClick={createCode} disabled={creating || !newCode.trim()} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" /> Erstellen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Codes table */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Beta-Codes ({codes.length})</CardTitle></CardHeader>
          <CardContent>
            {codes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Noch keine Beta-Codes vorhanden</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Nutzung</TableHead>
                      <TableHead>Ablauf</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead>Aktiv</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-semibold">{c.code}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.code)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {c.assigned_email && (
                            <span className="text-xs text-muted-foreground">{c.assigned_email}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {editingId === c.id ? (
                            <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Beschreibung" className="h-8 text-sm" />
                          ) : (c.description || '–')}
                        </TableCell>
                        <TableCell>
                          {editingId === c.id ? (
                            <Input type="number" value={editMaxUses} onChange={e => setEditMaxUses(e.target.value)} placeholder="∞" className="h-8 w-24 font-mono text-sm" />
                          ) : (
                            <span className="font-mono text-sm">
                              {c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ' / ∞'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.expires_at
                            ? format(new Date(c.expires_at), 'dd.MM.yyyy')
                            : '∞'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? 'default' : 'secondary'}>
                            {c.is_active ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(c.created_at), 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell>
                          <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                        </TableCell>
                        <TableCell>
                          {editingId === c.id ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(c.id)} disabled={saving}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
