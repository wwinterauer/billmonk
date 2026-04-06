import { useState } from 'react';
import { Plus, Trash2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemberTypes } from '@/hooks/useMemberTypes';
import { Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function MemberTypeConfig({ onClose }: Props) {
  const { memberTypes, loading, addType, updateType, deleteType } = useMemberTypes();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8B5CF6');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addType(newName.trim(), newColor);
    setNewName('');
    setNewColor('#8B5CF6');
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Kontakttypen verwalten</CardTitle>
            <CardDescription>Definiere eigene Kategorien wie Premium-Kunde, Vereinsmitglied, etc.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Schließen</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing types */}
        {memberTypes.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border">
            <div className="h-6 w-6 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#8B5CF6' }} />
            <Input
              value={t.name}
              className="flex-1"
              onChange={async (e) => {
                await updateType(t.id, { name: e.target.value });
              }}
              onBlur={async (e) => {
                if (e.target.value.trim()) {
                  await updateType(t.id, { name: e.target.value.trim() });
                }
              }}
            />
            <input
              type="color"
              value={t.color || '#8B5CF6'}
              onChange={async (e) => {
                await updateType(t.id, { color: e.target.value });
              }}
              className="h-8 w-8 cursor-pointer rounded border-0"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteType(t.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Add new */}
        <div className="flex items-center gap-3 pt-2">
          <Input
            placeholder="Neuer Typ (z.B. Sponsor)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-0"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
