import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain, CheckCircle, Clock, XCircle, Users, TrendingUp,
  Search, ChevronDown, ChevronUp, Edit2, Trash2, Check, X,
  BarChart3, Globe, Loader2, RefreshCw, ShieldCheck
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CommunityPattern {
  id: string;
  pattern_type: string;
  vendor_name_normalized: string | null;
  keyword: string | null;
  suggested_category: string;
  suggested_vat_rate: number | null;
  country: string | null;
  contributor_count: number;
  total_confirmations: number;
  is_verified: boolean;
  is_rejected: boolean;
  admin_reviewed: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PlatformSettings {
  is_active: boolean;
  verification_threshold: number;
  auto_verify: boolean;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const STATUS_COLORS = {
  verified: 'bg-green-500/10 text-green-700 border-green-200',
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
};

export function CommunityLearning() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>({ is_active: true, verification_threshold: 3, auto_verify: true });
  const [patterns, setPatterns] = useState<CommunityPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);
  const [optOutCount, setOptOutCount] = useState(0);
  const [totalPaidUsers, setTotalPaidUsers] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, patternsRes, optOutRes, paidRes] = await Promise.all([
        supabase.from('platform_learning_settings').select('*').eq('id', 1).single(),
        supabase.from('community_patterns').select('*').order('total_confirmations', { ascending: false }).limit(500),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('community_opt_out', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
      ]);

      if (settingsRes.data) {
        setSettings({
          is_active: settingsRes.data.is_active,
          verification_threshold: settingsRes.data.verification_threshold,
          auto_verify: settingsRes.data.auto_verify,
        });
      }
      if (patternsRes.data) setPatterns(patternsRes.data as unknown as CommunityPattern[]);
      setOptOutCount(optOutRes.count || 0);
      setTotalPaidUsers(paidRes.count || 0);
    } catch (err) {
      console.error('Error fetching community data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async (updates: Partial<PlatformSettings>) => {
    setSaving(true);
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      const { error } = await supabase
        .from('platform_learning_settings')
        .update({ ...newSettings, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      toast({ title: 'Einstellungen gespeichert' });
    } catch {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const verifyPattern = async (id: string) => {
    await supabase.from('community_patterns').update({ is_verified: true, is_rejected: false, admin_reviewed: true, updated_at: new Date().toISOString() }).eq('id', id);
    setPatterns(p => p.map(pat => pat.id === id ? { ...pat, is_verified: true, is_rejected: false, admin_reviewed: true } : pat));
    toast({ title: 'Muster verifiziert' });
  };

  const rejectPattern = async (id: string) => {
    await supabase.from('community_patterns').update({ is_verified: false, is_rejected: true, admin_reviewed: true, updated_at: new Date().toISOString() }).eq('id', id);
    setPatterns(p => p.map(pat => pat.id === id ? { ...pat, is_verified: false, is_rejected: true, admin_reviewed: true } : pat));
    toast({ title: 'Muster abgelehnt' });
  };

  const deletePattern = async (id: string) => {
    await supabase.from('community_patterns').delete().eq('id', id);
    setPatterns(p => p.filter(pat => pat.id !== id));
    toast({ title: 'Muster gelöscht' });
  };

  const saveNotes = async () => {
    if (!editingNotes) return;
    await supabase.from('community_patterns').update({ admin_notes: editingNotes.notes, admin_reviewed: true }).eq('id', editingNotes.id);
    setPatterns(p => p.map(pat => pat.id === editingNotes.id ? { ...pat, admin_notes: editingNotes.notes, admin_reviewed: true } : pat));
    setEditingNotes(null);
    toast({ title: 'Notiz gespeichert' });
  };

  const verifyAllPending = async () => {
    const pendingIds = patterns.filter(p => !p.is_verified && !p.is_rejected && p.contributor_count >= settings.verification_threshold).map(p => p.id);
    if (pendingIds.length === 0) return;
    for (const id of pendingIds) {
      await supabase.from('community_patterns').update({ is_verified: true, admin_reviewed: true, updated_at: new Date().toISOString() }).eq('id', id);
    }
    setPatterns(p => p.map(pat => pendingIds.includes(pat.id) ? { ...pat, is_verified: true, admin_reviewed: true } : pat));
    toast({ title: `${pendingIds.length} Muster verifiziert` });
  };

  // KPI calculations
  const totalPatterns = patterns.length;
  const verifiedPatterns = patterns.filter(p => p.is_verified).length;
  const pendingPatterns = patterns.filter(p => !p.is_verified && !p.is_rejected).length;
  const rejectedPatterns = patterns.filter(p => p.is_rejected).length;
  const uniqueContributors = new Set(patterns.flatMap(() => [])).size; // Approximation from contributor_count
  const totalContributors = patterns.reduce((acc, p) => acc + p.contributor_count, 0);
  const optOutRate = totalPaidUsers > 0 ? Math.round((optOutCount / totalPaidUsers) * 100) : 0;

  // Chart data
  const verificationData = [
    { name: 'Verifiziert', value: verifiedPatterns, color: '#22c55e' },
    { name: 'Wartend', value: pendingPatterns, color: '#eab308' },
    { name: 'Abgelehnt', value: rejectedPatterns, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const categoryAgg = patterns.reduce<Record<string, number>>((acc, p) => {
    if (p.is_verified) {
      acc[p.suggested_category] = (acc[p.suggested_category] || 0) + 1;
    }
    return acc;
  }, {});
  const topCategories = Object.entries(categoryAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count }));

  const countryAgg = patterns.reduce<Record<string, number>>((acc, p) => {
    const c = p.country || 'Unbekannt';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const countryData = Object.entries(countryAgg).map(([name, value]) => ({ name, value }));

  // Filtered patterns
  const filtered = patterns.filter(p => {
    if (statusFilter === 'verified' && !p.is_verified) return false;
    if (statusFilter === 'pending' && (p.is_verified || p.is_rejected)) return false;
    if (statusFilter === 'rejected' && !p.is_rejected) return false;
    if (countryFilter !== 'all' && p.country !== countryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (p.vendor_name_normalized || '').includes(s) ||
        p.suggested_category.toLowerCase().includes(s) ||
        (p.keyword || '').toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Community Intelligence — Einstellungen
          </CardTitle>
          <CardDescription>
            Anonymisierte Muster aus User-Korrekturen für plattformweite Verbesserung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Community Learning</Label>
                <p className="text-xs text-muted-foreground">Plattform-weites Lernen aktiv</p>
              </div>
              <Switch checked={settings.is_active} onCheckedChange={v => saveSettings({ is_active: v })} disabled={saving} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto-Verifikation</Label>
                <p className="text-xs text-muted-foreground">Automatisch bei Schwelle</p>
              </div>
              <Switch checked={settings.auto_verify} onCheckedChange={v => saveSettings({ auto_verify: v })} disabled={saving} />
            </div>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Verifikations-Schwelle</Label>
                <Badge variant="outline" className="font-mono">{settings.verification_threshold} User</Badge>
              </div>
              <Slider
                value={[settings.verification_threshold]}
                min={1} max={10} step={1}
                onValueCommit={v => saveSettings({ verification_threshold: v[0] })}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-foreground">{totalPatterns}</div>
            <p className="text-xs text-muted-foreground mt-1">Muster gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-600">{verifiedPatterns}</div>
            <p className="text-xs text-muted-foreground mt-1">Verifiziert</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingPatterns}</div>
            <p className="text-xs text-muted-foreground mt-1">Wartend</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-foreground">{totalContributors}</div>
            <p className="text-xs text-muted-foreground mt-1">Beiträge gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-foreground">{optOutRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Opt-Out Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Verification donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Verifikations-Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verificationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={verificationData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {verificationData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Keine Daten</div>
            )}
            <div className="flex justify-center gap-4 mt-2">
              {verificationData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Top Kategorien (verifiziert)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topCategories} layout="vertical" margin={{ left: 5, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Keine Daten</div>
            )}
          </CardContent>
        </Card>

        {/* Country distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" /> Länder-Verteilung
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={countryData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {countryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Keine Daten</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pattern Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-base">Community-Muster ({filtered.length})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren
              </Button>
              <Button variant="default" size="sm" onClick={verifyAllPending} disabled={pendingPatterns === 0}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Alle Wartenden verifizieren
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Suche nach Lieferant, Kategorie..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="verified">Verifiziert</SelectItem>
                <SelectItem value="pending">Wartend</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Länder</SelectItem>
                <SelectItem value="AT">AT</SelectItem>
                <SelectItem value="DE">DE</SelectItem>
                <SelectItem value="CH">CH</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lieferant / Keyword</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-center">Land</TableHead>
                  <TableHead className="text-center">Bestätigungen</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Keine Muster gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 100).map(pattern => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {pattern.vendor_name_normalized || pattern.keyword || '—'}
                        {pattern.admin_notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{pattern.admin_notes}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{pattern.suggested_category}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">{pattern.country || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm">{pattern.contributor_count}</span>
                          <span className="text-muted-foreground text-xs">({pattern.total_confirmations}×)</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            pattern.is_verified
                              ? STATUS_COLORS.verified
                              : pattern.is_rejected
                              ? STATUS_COLORS.rejected
                              : STATUS_COLORS.pending
                          }
                        >
                          {pattern.is_verified ? (
                            <><CheckCircle className="h-3 w-3 mr-1" />Verifiziert</>
                          ) : pattern.is_rejected ? (
                            <><XCircle className="h-3 w-3 mr-1" />Abgelehnt</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" />Wartend</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!pattern.is_verified && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => verifyPattern(pattern.id)} title="Verifizieren">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {!pattern.is_rejected && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => rejectPattern(pattern.id)} title="Ablehnen">
                              <X className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingNotes({ id: pattern.id, notes: pattern.admin_notes || '' })} title="Notiz">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePattern(pattern.id)} title="Löschen">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">Zeige 100 von {filtered.length} Mustern</p>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={!!editingNotes} onOpenChange={() => setEditingNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin-Notiz</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingNotes?.notes || ''}
            onChange={e => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
            placeholder="Notiz zum Muster..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotes(null)}>Abbrechen</Button>
            <Button onClick={saveNotes}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
