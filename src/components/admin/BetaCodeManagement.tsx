import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BetaCode {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  created_at: string;
}

export function BetaCodeManagement() {
  const [codes, setCodes] = useState<BetaCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCodes = async () => {
    const { data } = await supabase
      .from('beta_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes((data as BetaCode[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

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

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
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
                    <TableHead>Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Aktiv</TableHead>
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
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.description || '–'}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ' / ∞'}
                        </span>
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
