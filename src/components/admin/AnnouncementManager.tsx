import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchAnnouncements = async () => {
    // Admin can see all announcements via the edge function or direct query
    // Since RLS only shows active ones, we use admin-system-health or a broader policy
    // For simplicity, we query what's visible + manage via insert/update
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const createAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Titel und Nachricht sind erforderlich');
      return;
    }

    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      message: message.trim(),
      type,
      expires_at: expiresAt || null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });

    if (error) {
      toast.error('Fehler beim Erstellen: ' + error.message);
      return;
    }

    toast.success('Ankündigung erstellt');
    setTitle('');
    setMessage('');
    setType('info');
    setExpiresAt('');
    fetchAnnouncements();
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (error) {
      toast.error('Fehler: ' + error.message);
      return;
    }
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast.error('Fehler: ' + error.message);
      return;
    }
    toast.success('Ankündigung gelöscht');
    fetchAnnouncements();
  };

  const typeBadgeVariant = (t: string) => {
    switch (t) {
      case 'warning': return 'destructive' as const;
      case 'maintenance': return 'secondary' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Neue Ankündigung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Wartungsarbeiten" />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>Typ</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warnung</SelectItem>
                    <SelectItem value="maintenance">Wartung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label>Ablaufdatum</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nachricht</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nachricht an alle Benutzer..." />
          </div>
          <Button onClick={createAnnouncement}>
            <Megaphone className="h-4 w-4 mr-2" />
            Veröffentlichen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bestehende Ankündigungen</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden...</p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Ankündigungen vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{a.title}</span>
                      <Badge variant={typeBadgeVariant(a.type)}>{a.type}</Badge>
                      {!a.is_active && <Badge variant="outline">Inaktiv</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Erstellt: {format(new Date(a.created_at), 'dd.MM.yyyy HH:mm')}
                      {a.expires_at && ` · Läuft ab: ${format(new Date(a.expires_at), 'dd.MM.yyyy HH:mm')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteAnnouncement(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
