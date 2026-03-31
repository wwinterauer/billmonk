import { useState, useEffect } from 'react';
import { Save, Settings2, Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { Loader2 } from 'lucide-react';

export function InvoiceModuleSettings() {
  const { settings, loading, saveSettings } = useInvoiceSettings();
  const [form, setForm] = useState({
    auto_send_enabled: false,
    send_copy_to_self: true,
    overdue_reminder_enabled: false,
    overdue_reminder_days: 7,
    reminder_stage_1_days: 7,
    reminder_stage_2_days: 14,
    reminder_stage_3_days: 14,
    overdue_email_notify: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        auto_send_enabled: settings.auto_send_enabled ?? false,
        send_copy_to_self: settings.send_copy_to_self ?? true,
        overdue_reminder_enabled: settings.overdue_reminder_enabled ?? false,
        overdue_reminder_days: settings.overdue_reminder_days ?? 7,
        reminder_stage_1_days: (settings as any).reminder_stage_1_days ?? 7,
        reminder_stage_2_days: (settings as any).reminder_stage_2_days ?? 14,
        reminder_stage_3_days: (settings as any).reminder_stage_3_days ?? 14,
        overdue_email_notify: (settings as any).overdue_email_notify ?? false,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form as any);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Rechnungsmodul-Einstellungen</CardTitle>
              <CardDescription>Automatisierung, Versand und Mahnwesen</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Send */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2"><Send className="h-4 w-4" /> Versand</h3>
            <div className="flex items-center justify-between">
              <div>
                <Label>Automatischer Versand</Label>
                <p className="text-xs text-muted-foreground">Wiederkehrende Rechnungen automatisch per E-Mail senden</p>
              </div>
              <Switch checked={form.auto_send_enabled} onCheckedChange={v => setForm(f => ({ ...f, auto_send_enabled: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Kopie an mich</Label>
                <p className="text-xs text-muted-foreground">Bei Versand eine Kopie an die eigene E-Mail-Adresse senden</p>
              </div>
              <Switch checked={form.send_copy_to_self} onCheckedChange={v => setForm(f => ({ ...f, send_copy_to_self: v }))} />
            </div>
          </div>

          <Separator />

          {/* Reminders */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2"><Bell className="h-4 w-4" /> Mahnwesen</h3>
            <div className="flex items-center justify-between">
              <div>
                <Label>Zahlungserinnerungen</Label>
                <p className="text-xs text-muted-foreground">Automatisch Mahnstufen setzen wenn Rechnung überfällig wird</p>
              </div>
              <Switch checked={form.overdue_reminder_enabled} onCheckedChange={v => setForm(f => ({ ...f, overdue_reminder_enabled: v }))} />
            </div>
            {form.overdue_reminder_enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Überfällig nach (Tage)</Label>
                    <Input type="number" value={form.reminder_stage_1_days} onChange={e => setForm(f => ({ ...f, reminder_stage_1_days: parseInt(e.target.value) || 7 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">Status → Überfällig</p>
                  </div>
                  <div>
                    <Label className="text-xs">1. Mahnung nach (Tage)</Label>
                    <Input type="number" value={form.reminder_stage_2_days} onChange={e => setForm(f => ({ ...f, reminder_stage_2_days: parseInt(e.target.value) || 14 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">Status → 1. Mahnung</p>
                  </div>
                  <div>
                    <Label className="text-xs">2. Mahnung nach (Tage)</Label>
                    <Input type="number" value={form.reminder_stage_3_days} onChange={e => setForm(f => ({ ...f, reminder_stage_3_days: parseInt(e.target.value) || 14 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">Status → 2. Mahnung</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>E-Mail-Benachrichtigung</Label>
                    <p className="text-xs text-muted-foreground">Mich per E-Mail benachrichtigen wenn eine Rechnung überfällig wird</p>
                  </div>
                  <Switch checked={form.overdue_email_notify} onCheckedChange={v => setForm(f => ({ ...f, overdue_email_notify: v }))} />
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
