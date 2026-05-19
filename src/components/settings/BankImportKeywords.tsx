import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCategories } from '@/hooks/useCategories';
import { useTags } from '@/hooks/useTags';
import { VendorAutocomplete } from '@/components/receipts/VendorAutocomplete';
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  FileX,
  Loader2,
  Info,
  Sparkles,
  Ban,
  X,
} from 'lucide-react';

interface BankKeyword {
  id: string;
  keyword: string;
  category: string | null;
  description_template: string | null;
  tax_rate: number;
  tax_type: string | null;
  vendor_id: string | null;
  is_active: boolean;
  is_ignore: boolean;
  default_tag_ids: string[] | null;
}

const CATEGORIES = [
  'Bankgebühren',
  'Steuern & Abgaben',
  'Versicherungen',
  'Sozialversicherung',
  'Betriebskosten',
  'Miete & Pacht',
  'Telefon & Internet',
  'Sonstige Ausgaben',
];

const NONE_VALUE = '__none__';

export function BankImportKeywords() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { taxCategories } = useCategories();
  const { activeTags } = useTags();

  const [showDialog, setShowDialog] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<BankKeyword | null>(null);
  const [formData, setFormData] = useState({
    keyword: '',
    category: '',
    description_template: '',
    tax_rate: '0',
    tax_type: '',
    vendor_id: '' as string | '',
    vendor_name: '',
    is_ignore: false,
    default_tag_ids: [] as string[],
  });

  const sortedTags = [...activeTags].sort((a, b) =>
    a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  );
  const tagsById = Object.fromEntries(activeTags.map((t) => [t.id, t]));

  // Vendor-Namen für Tabelle laden
  const { data: vendorMap } = useQuery({
    queryKey: ['vendors-name-map'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, display_name');
      const map: Record<string, string> = {};
      (data ?? []).forEach((v: any) => { map[v.id] = v.display_name; });
      return map;
    },
  });

  // Keywords laden
  const { data: keywords, isLoading } = useQuery({
    queryKey: ['bank-import-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_import_keywords')
        .select('*')
        .order('keyword', { ascending: true });

      if (error) throw error;
      return data as BankKeyword[];
    },
  });

  // Keyword speichern
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      // Lieferant ggf. neu anlegen, wenn Name eingegeben aber keine vendor_id ausgewählt
      let vendorId: string | null = data.vendor_id || null;
      const vendorName = data.vendor_name.trim();
      if (!vendorId && vendorName) {
        const { data: existing } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .ilike('display_name', vendorName)
          .maybeSingle();
        if (existing?.id) {
          vendorId = existing.id;
        } else {
          const { data: newVendor, error: vErr } = await supabase
            .from('vendors')
            .insert({ user_id: user.id, display_name: vendorName })
            .select('id')
            .single();
          if (vErr) throw vErr;
          vendorId = newVendor.id;
        }
      }

      const payload = {
        keyword: data.keyword,
        category: data.category || null,
        description_template: data.description_template || null,
        tax_rate: parseFloat(data.tax_rate) || 0,
        tax_type: data.tax_type || null,
        vendor_id: vendorId,
        is_ignore: data.is_ignore,
        default_tag_ids: data.default_tag_ids ?? [],
      };

      if (editingKeyword) {
        const { error } = await supabase
          .from('bank_import_keywords')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingKeyword.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_import_keywords')
          .insert({ user_id: user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-import-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['vendors-name-map'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: editingKeyword ? 'Schlagwort aktualisiert' : 'Schlagwort hinzugefügt',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_import_keywords').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-import-keywords'] });
      toast({ title: 'Schlagwort gelöscht' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('bank_import_keywords')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-import-keywords'] });
    },
  });

  const createDefaultsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const defaults = [
        { keyword: 'Kontoführung', category: 'Bankgebühren', description_template: 'Kontoführungsgebühr', tax_rate: 0 },
        { keyword: 'Kontof', category: 'Bankgebühren', description_template: 'Kontoführungsgebühr', tax_rate: 0 },
        { keyword: 'Kest', category: 'Steuern & Abgaben', description_template: 'Kapitalertragsteuer', tax_rate: 0 },
        { keyword: 'Zinsen', category: 'Bankgebühren', description_template: 'Sollzinsen', tax_rate: 0 },
        { keyword: 'Generali', category: 'Versicherungen', description_template: 'Versicherung Generali', tax_rate: 0 },
        { keyword: 'Uniqa', category: 'Versicherungen', description_template: 'Versicherung UNIQA', tax_rate: 0 },
        { keyword: 'Allianz', category: 'Versicherungen', description_template: 'Versicherung Allianz', tax_rate: 0 },
        { keyword: 'SVS', category: 'Sozialversicherung', description_template: 'Sozialversicherung SVS', tax_rate: 0 },
        { keyword: 'ÖGK', category: 'Sozialversicherung', description_template: 'Österreichische Gesundheitskasse', tax_rate: 0 },
        { keyword: 'GIS', category: 'Betriebskosten', description_template: 'GIS Gebühr', tax_rate: 0 },
      ];

      for (const kw of defaults) {
        await supabase
          .from('bank_import_keywords')
          .upsert({ user_id: user.id, ...kw }, { onConflict: 'user_id,keyword' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-import-keywords'] });
      toast({ title: 'Standard-Schlagwörter erstellt' });
    },
  });

  const resetForm = () => {
    setFormData({
      keyword: '',
      category: '',
      description_template: '',
      tax_rate: '0',
      tax_type: '',
      vendor_id: '',
      vendor_name: '',
      is_ignore: false,
      default_tag_ids: [],
    });
    setEditingKeyword(null);
  };

  const handleEdit = (keyword: BankKeyword) => {
    setEditingKeyword(keyword);
    setFormData({
      keyword: keyword.keyword,
      category: keyword.category || '',
      description_template: keyword.description_template || '',
      tax_rate: keyword.tax_rate.toString(),
      tax_type: keyword.tax_type || '',
      vendor_id: keyword.vendor_id || '',
      vendor_name: (keyword.vendor_id && vendorMap?.[keyword.vendor_id]) || '',
      is_ignore: keyword.is_ignore ?? false,
      default_tag_ids: (keyword.default_tag_ids ?? []).filter(Boolean),
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.keyword.trim()) {
      toast({ title: 'Schlagwort erforderlich', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileX className="h-5 w-5" />
          Buchungen ohne Rechnung
        </CardTitle>
        <CardDescription>
          Definiere Schlagwörter für Bankbuchungen die automatisch als Ausgaben erfasst werden sollen,
          auch wenn keine Rechnung vorhanden ist (z.B. Bankgebühren, Versicherungen, Steuern).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>So funktioniert's:</strong> Beim Bank-Import wird der Verwendungszweck nach diesen
            Schlagwörtern durchsucht. Treffer werden automatisch als Ausgabe erfasst mit dem Vermerk
            "Keine Rechnung vorhanden".
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Schlagwort hinzufügen
          </Button>

          {(!keywords || keywords.length === 0) && (
            <Button
              variant="outline"
              onClick={() => createDefaultsMutation.mutate()}
              disabled={createDefaultsMutation.isPending}
            >
              {createDefaultsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Standard-Schlagwörter laden
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keywords && keywords.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schlagwort</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Steuerart</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-right">MwSt</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                  <TableHead className="w-[100px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => (
                  <TableRow key={kw.id} className={!kw.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {kw.is_ignore ? (
                          <Ban className="h-4 w-4 text-destructive" />
                        ) : (
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{kw.keyword}</span>
                        {kw.is_ignore && (
                          <Badge variant="destructive" className="text-xs">Ignorieren</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {kw.category && <Badge variant="secondary">{kw.category}</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {kw.vendor_id ? (vendorMap?.[kw.vendor_id] ?? '…') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {kw.tax_type || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {kw.description_template || '-'}
                    </TableCell>
                    <TableCell className="text-right">{kw.tax_rate}%</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={kw.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: kw.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(kw)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Schlagwort wirklich löschen?')) {
                              deleteMutation.mutate(kw.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileX className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Noch keine Schlagwörter definiert</p>
            <p className="text-sm mt-1">Klicke auf "Standard-Schlagwörter laden" um mit typischen Einträgen zu starten.</p>
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowDialog(open); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingKeyword ? 'Schlagwort bearbeiten' : 'Neues Schlagwort'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">Schlagwort *</Label>
                <Input
                  id="keyword"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="z.B. Kontoführung, Generali, Kest"
                />
                <p className="text-xs text-muted-foreground">
                  Wird im Verwendungszweck gesucht (Groß-/Kleinschreibung wird ignoriert)
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    Buchung komplett ignorieren
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Beim CSV-Import werden Treffer für dieses Schlagwort übersprungen –
                    keine Bankbuchung und kein Beleg werden angelegt.
                  </p>
                </div>
                <Switch
                  checked={formData.is_ignore}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_ignore: checked })}
                />
              </div>

              {!formData.is_ignore && (
              <>
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <SearchableSelect
                  value={formData.category}
                  onChange={(value) => setFormData({ ...formData, category: value })}
                  options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  placeholder="Kategorie wählen..."
                  searchPlaceholder="Kategorie suchen..."
                  allowClear
                />
              </div>

              <VendorAutocomplete
                value={formData.vendor_name}
                vendorId={formData.vendor_id || null}
                onChange={(value, vendorId) =>
                  setFormData({ ...formData, vendor_name: value, vendor_id: vendorId || '' })
                }
                onVendorSelect={(vendor) =>
                  setFormData({ ...formData, vendor_name: vendor.display_name, vendor_id: vendor.id })
                }
                label="Lieferant (optional)"
                placeholder="Bestehenden Lieferant wählen oder neu anlegen…"
              />

              <div className="space-y-2">
                <Label>Steuerart (optional)</Label>
                <SearchableSelect
                  value={formData.tax_type || ''}
                  onChange={(value) => setFormData({ ...formData, tax_type: value })}
                  options={taxCategories.map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Keine Voreinstellung"
                  searchPlaceholder="Buchungsart suchen..."
                  allowClear
                  clearLabel="Keine Voreinstellung"
                />
                <p className="text-xs text-muted-foreground">
                  Wird beim automatisch erstellten Beleg als Steuer-Buchungsart gesetzt.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung (Vorlage)</Label>
                <Input
                  id="description"
                  value={formData.description_template}
                  onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                  placeholder="z.B. Kontoführungsgebühr"
                />
              </div>

              <div className="space-y-2">
                <Label>MwSt-Satz (%)</Label>
                <Select
                  value={formData.tax_rate}
                  onValueChange={(value) => setFormData({ ...formData, tax_rate: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Keine MwSt)</SelectItem>
                    <SelectItem value="10">10% (AT ermäßigt)</SelectItem>
                    <SelectItem value="13">13% (AT ermäßigt)</SelectItem>
                    <SelectItem value="20">20% (AT normal)</SelectItem>
                    <SelectItem value="7">7% (DE ermäßigt)</SelectItem>
                    <SelectItem value="19">19% (DE normal)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bankgebühren, Versicherungen und Steuern haben meist 0% MwSt
                </p>
              </div>
              </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingKeyword ? 'Speichern' : 'Hinzufügen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
