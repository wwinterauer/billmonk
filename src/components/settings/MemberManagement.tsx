import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Mail, Phone, MapPin, Users, Crown, Star, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMembers, Member } from '@/hooks/useMembers';
import { useMemberTypes } from '@/hooks/useMemberTypes';
import { Loader2 } from 'lucide-react';
import { MemberTypeConfig } from './MemberTypeConfig';

const EMPTY_FORM = {
  display_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  street: '',
  zip: '',
  city: '',
  country: 'AT',
  member_number: '',
  member_type: 'Mitglied',
  membership_fee: 0,
  joined_at: '',
  is_active: true,
  newsletter_opt_out: false,
  notes: '',
};

export function MemberManagement() {
  const { members, loading, addMember, updateMember, deleteMember } = useMembers();
  const { memberTypes } = useMemberTypes();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTypeConfig, setShowTypeConfig] = useState(false);

  const filtered = members.filter(m => {
    if (!showInactive && m.is_active === false) return false;
    if (showInactive && m.is_active !== false) return false;
    if (filterType !== 'all' && m.member_type !== filterType) return false;
    const q = search.toLowerCase();
    return !q || m.display_name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.member_number?.toLowerCase().includes(q);
  });

  const getTypeColor = (typeName: string | null) => {
    const t = memberTypes.find(mt => mt.name === typeName);
    return t?.color || '#8B5CF6';
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, joined_at: new Date().toISOString().split('T')[0] });
    setDialogOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({
      display_name: m.display_name || '',
      first_name: m.first_name || '',
      last_name: m.last_name || '',
      email: m.email || '',
      phone: m.phone || '',
      street: m.street || '',
      zip: m.zip || '',
      city: m.city || '',
      country: m.country || 'AT',
      member_number: m.member_number || '',
      member_type: m.member_type || 'Mitglied',
      membership_fee: m.membership_fee || 0,
      joined_at: m.joined_at || '',
      is_active: m.is_active !== false,
      newsletter_opt_out: m.newsletter_opt_out || false,
      notes: m.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) return;
    if (editingId) {
      await updateMember(editingId, form as any);
    } else {
      await addMember(form as any);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMember(deleteId);
      setDeleteId(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Type Config Toggle */}
      {showTypeConfig && (
        <MemberTypeConfig onClose={() => setShowTypeConfig(false)} />
      )}

      {/* Member List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Mitglieder & Kontakte</CardTitle>
              <CardDescription>Verwalte Vereinsmitglieder, Premium-Kunden und weitere Kontaktgruppen</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTypeConfig(!showTypeConfig)}>
                <Star className="h-4 w-4 mr-1" /> Typen
              </Button>
              <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Mitglied</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
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
            <Button variant={showInactive ? 'secondary' : 'outline'} size="sm" onClick={() => setShowInactive(!showInactive)}>
              <Archive className="h-4 w-4 mr-1" /> Inaktiv
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Mitglieder gefunden</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: getTypeColor(m.member_type) }}>
                    {m.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{m.display_name}</span>
                      {m.member_number && <Badge variant="outline" className="text-xs">{m.member_number}</Badge>}
                      {m.member_type && (
                        <Badge className="text-xs" style={{ backgroundColor: getTypeColor(m.member_type), color: 'white' }}>
                          {m.member_type}
                        </Badge>
                      )}
                      {m.is_active === false && <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                      {m.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.city}</span>}
                      {m.membership_fee != null && m.membership_fee > 0 && (
                        <span>€ {Number(m.membership_fee).toFixed(2)}/Monat</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div><Label>Anzeigename *</Label><Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vorname</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>Nachname</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mitgliedsnummer</Label><Input value={form.member_number} onChange={e => setForm(f => ({ ...f, member_number: e.target.value }))} /></div>
              <div>
                <Label>Typ / Gruppe</Label>
                <Select value={form.member_type} onValueChange={v => setForm(f => ({ ...f, member_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {memberTypes.map(t => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mitgliedsbeitrag (€)</Label><Input type="number" step="0.01" min="0" value={form.membership_fee} onChange={e => setForm(f => ({ ...f, membership_fee: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Beitrittsdatum</Label><Input type="date" value={form.joined_at} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))} /></div>
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Adresse</p>
            <div><Label>Straße</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>PLZ</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
              <div><Label>Stadt</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Land</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Newsletter abbestellt</Label>
              <Switch checked={form.newsletter_opt_out} onCheckedChange={v => setForm(f => ({ ...f, newsletter_opt_out: v }))} />
            </div>
            <div><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.display_name.trim()}>{editingId ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mitglied löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Dieses Mitglied wird unwiderruflich gelöscht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
