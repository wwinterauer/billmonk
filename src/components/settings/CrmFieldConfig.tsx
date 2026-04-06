import { useState } from 'react';
import { Settings2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrmFieldConfig, CUSTOMER_FIELD_OPTIONS, MEMBER_FIELD_OPTIONS } from '@/hooks/useCrmFieldConfig';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function CrmFieldConfig() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'customer' | 'member'>('customer');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Feldkonfiguration</CardTitle>
            <CardDescription>Wähle welche Felder in der Liste und im Formular angezeigt werden</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={v => setTab(v as 'customer' | 'member')}>
          <TabsList className="mb-4">
            <TabsTrigger value="customer">Kunden</TabsTrigger>
            <TabsTrigger value="member">Mitglieder</TabsTrigger>
          </TabsList>
          <TabsContent value="customer">
            <FieldConfigPanel entityType="customer" fieldOptions={CUSTOMER_FIELD_OPTIONS} />
          </TabsContent>
          <TabsContent value="member">
            <FieldConfigPanel entityType="member" fieldOptions={MEMBER_FIELD_OPTIONS} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FieldConfigPanel({ entityType, fieldOptions }: { entityType: 'customer' | 'member'; fieldOptions: { key: string; label: string }[] }) {
  const { visibleFields, listColumns, saveConfig, loading } = useCrmFieldConfig(entityType);
  const { toast } = useToast();
  const [localVisible, setLocalVisible] = useState<string[]>(visibleFields);
  const [localColumns, setLocalColumns] = useState<string[]>(listColumns);
  const [saving, setSaving] = useState(false);

  // Sync when loading finishes
  if (!loading && localVisible.length === 0 && visibleFields.length > 0) {
    setLocalVisible(visibleFields);
    setLocalColumns(listColumns);
  }

  const toggleField = (key: string, type: 'visible' | 'column') => {
    if (type === 'visible') {
      setLocalVisible(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
    } else {
      setLocalColumns(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(localVisible, localColumns);
    toast({ title: 'Feldkonfiguration gespeichert' });
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium mb-3">Im Formular sichtbar</h4>
          <div className="space-y-2">
            {fieldOptions.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <Checkbox
                  checked={localVisible.includes(f.key)}
                  onCheckedChange={() => toggleField(f.key, 'visible')}
                  id={`visible-${entityType}-${f.key}`}
                />
                <Label htmlFor={`visible-${entityType}-${f.key}`} className="cursor-pointer text-sm">{f.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-3">In der Listansicht</h4>
          <div className="space-y-2">
            {fieldOptions.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <Checkbox
                  checked={localColumns.includes(f.key)}
                  onCheckedChange={() => toggleField(f.key, 'column')}
                  id={`column-${entityType}-${f.key}`}
                />
                <Label htmlFor={`column-${entityType}-${f.key}`} className="cursor-pointer text-sm">{f.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
        Speichern
      </Button>
    </div>
  );
}
