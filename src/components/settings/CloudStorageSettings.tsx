import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cloud, Check, X, Loader2, Calendar, FileText, Shield, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useExportTemplates } from '@/hooks/useExportTemplates';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface CloudConnection {
  id: string;
  provider: string;
  display_name: string | null;
  is_active: boolean;
  oauth_token_expires_at: string | null;
  backup_enabled: boolean;
  backup_schedule_type: string;
  backup_weekday: number;
  backup_day_of_month: number | null;
  backup_time: string;
  backup_file_prefix: string;
  backup_include_files: boolean;
  backup_include_invoices: boolean;
  backup_status_filter: string[];
  backup_template_id: string | null;
  backup_include_excel: boolean;
  backup_include_csv: boolean;
  backup_zip_pattern: string;
  backup_folder_structure: string;
  last_backup_at: string | null;
  last_backup_count: number | null;
  last_backup_error: string | null;
  next_backup_at: string | null;
  created_at: string | null;
}

const WEEKDAYS = [
  { value: '0', label: 'Sonntag' },
  { value: '1', label: 'Montag' },
  { value: '2', label: 'Dienstag' },
  { value: '3', label: 'Mittwoch' },
  { value: '4', label: 'Donnerstag' },
  { value: '5', label: 'Freitag' },
  { value: '6', label: 'Samstag' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ausstehend' },
  { value: 'processing', label: 'In Verarbeitung' },
  { value: 'review', label: 'Zur Prüfung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'rejected', label: 'Abgelehnt' },
  { value: 'completed', label: 'Abgeschlossen' },
];

const ZIP_PLACEHOLDERS = [
  { key: '{prefix}', desc: 'Datei-Präfix' },
  { key: '{datum}', desc: 'Datum (YYYY-MM-DD)' },
  { key: '{zeit}', desc: 'Uhrzeit (HHmm)' },
  { key: '{anzahl}', desc: 'Anzahl Belege' },
  { key: '{monat}', desc: 'Monat (MM)' },
  { key: '{jahr}', desc: 'Jahr (YYYY)' },
];

export const CloudStorageSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<CloudConnection | null>(null);
  const { templates, loading: templatesLoading } = useExportTemplates();

  // Check for OAuth callback results
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');

    if (oauthSuccess === 'google_drive') {
      toast({
        title: 'Google Drive verbunden',
        description: 'Dein Google Drive Konto wurde erfolgreich verknüpft.',
      });
      loadConnection();
    } else if (oauthError && searchParams.get('tab') === 'cloud-storage') {
      toast({
        variant: 'destructive',
        title: 'Verbindungsfehler',
        description: oauthError,
      });
    }
  }, [searchParams]);

  const loadConnection = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cloud_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google_drive')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConnection({
          id: data.id,
          provider: data.provider || 'google_drive',
          display_name: data.display_name,
          is_active: data.is_active ?? true,
          oauth_token_expires_at: data.oauth_token_expires_at,
          backup_enabled: data.backup_enabled ?? false,
          backup_schedule_type: data.backup_schedule_type || 'weekly',
          backup_weekday: data.backup_weekday ?? 1,
          backup_day_of_month: data.backup_day_of_month,
          backup_time: data.backup_time || '02:00',
          backup_file_prefix: data.backup_file_prefix || 'XpenzAI-Backup',
          backup_include_files: data.backup_include_files ?? true,
          backup_include_invoices: (data as any).backup_include_invoices ?? false,
          backup_status_filter: data.backup_status_filter || ['review'],
          backup_template_id: data.backup_template_id,
          backup_include_excel: (data as any).backup_include_excel ?? true,
          backup_include_csv: (data as any).backup_include_csv ?? true,
          backup_zip_pattern: (data as any).backup_zip_pattern || '{prefix}_{datum}_{zeit}',
          backup_folder_structure: (data as any).backup_folder_structure || 'flat',
          last_backup_at: data.last_backup_at,
          last_backup_count: data.last_backup_count,
          last_backup_error: data.last_backup_error,
          next_backup_at: data.next_backup_at,
          created_at: data.created_at,
        });
      }
    } catch (error) {
      console.error('Error loading cloud connection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnection();
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const response = await supabase.functions.invoke('oauth-start', {
        body: { provider: 'google_drive' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      const { authUrl } = response.data;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error('Keine Auth-URL erhalten');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verbindungsfehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      const { error } = await supabase
        .from('cloud_connections')
        .delete()
        .eq('id', connection.id);

      if (error) throw error;

      setConnection(null);
      toast({
        title: 'Verbindung getrennt',
        description: 'Google Drive wurde erfolgreich getrennt.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Verbindung konnte nicht getrennt werden.',
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!connection) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cloud_connections')
        .update({
          backup_enabled: connection.backup_enabled,
          backup_schedule_type: connection.backup_schedule_type,
          backup_weekday: connection.backup_weekday,
          backup_day_of_month: connection.backup_day_of_month,
          backup_time: connection.backup_time,
          backup_file_prefix: connection.backup_file_prefix,
          backup_include_files: connection.backup_include_files,
          backup_status_filter: connection.backup_status_filter,
          backup_template_id: connection.backup_template_id,
          backup_include_excel: connection.backup_include_excel,
          backup_include_csv: connection.backup_include_csv,
          backup_zip_pattern: connection.backup_zip_pattern,
          backup_folder_structure: connection.backup_folder_structure,
        } as any)
        .eq('id', connection.id);

      if (error) throw error;

      toast({
        title: 'Einstellungen gespeichert',
        description: 'Backup-Konfiguration wurde aktualisiert.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunBackupNow = async () => {
    if (!connection) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const response = await supabase.functions.invoke('backup-to-drive', {
        body: { connectionId: connection.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: 'Backup gestartet',
        description: response.data?.message || 'Das Backup wird im Hintergrund durchgeführt.',
      });

      setTimeout(loadConnection, 3000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Backup fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  const updateConnection = (updates: Partial<CloudConnection>) => {
    if (!connection) return;
    setConnection({ ...connection, ...updates });
  };

  const toggleStatusFilter = (status: string) => {
    if (!connection) return;
    const current = connection.backup_status_filter;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateConnection({ backup_status_filter: updated });
  };

  // Generate ZIP name preview
  const getZipPreview = () => {
    if (!connection) return '';
    const now = new Date();
    return connection.backup_zip_pattern
      .replace('{prefix}', connection.backup_file_prefix || 'XpenzAI-Backup')
      .replace('{datum}', format(now, 'yyyy-MM-dd'))
      .replace('{zeit}', format(now, 'HHmm'))
      .replace('{anzahl}', '12')
      .replace('{monat}', format(now, 'MM'))
      .replace('{jahr}', format(now, 'yyyy'))
      + '.zip';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Google Drive</CardTitle>
              <CardDescription>
                Verbinde dein Google Drive für automatische Backups deiner Belege
              </CardDescription>
            </div>
            {connection && (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                <Check className="h-3 w-3" />
                Verbunden
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!connection ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Verknüpfe dein Google Drive Konto, um automatische Backups deiner Belege einzurichten.
                Die App erhält nur Zugriff auf selbst erstellte Dateien.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Eingeschränkter Zugriff: Nur App-erstellte Dateien (drive.file Scope)</span>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verbinde...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-2" />
                    Mit Google Drive verbinden
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{connection.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Verbunden seit {connection.created_at ? format(new Date(connection.created_at), 'dd. MMMM yyyy', { locale: de }) : 'Unbekannt'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <X className="h-4 w-4 mr-1" />
                  Trennen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Configuration */}
      {connection && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>Automatisches Backup</CardTitle>
                <CardDescription>
                  Konfiguriere das zeitgesteuerte Backup deiner Belege nach Google Drive
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Backup aktivieren</Label>
                <p className="text-xs text-muted-foreground">Belege automatisch nach Google Drive sichern</p>
              </div>
              <Switch
                checked={connection.backup_enabled}
                onCheckedChange={(checked) => updateConnection({ backup_enabled: checked })}
              />
            </div>

            {connection.backup_enabled && (
              <>
                {/* Schedule Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Zeitplan</Label>
                    <Select
                      value={connection.backup_schedule_type}
                      onValueChange={(value) => updateConnection({ backup_schedule_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Wöchentlich</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {connection.backup_schedule_type === 'weekly' ? (
                    <div className="space-y-2">
                      <Label>Wochentag</Label>
                      <Select
                        value={String(connection.backup_weekday)}
                        onValueChange={(value) => updateConnection({ backup_weekday: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map(day => (
                            <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Tag im Monat</Label>
                      <Select
                        value={String(connection.backup_day_of_month || 1)}
                        onValueChange={(value) => updateConnection({ backup_day_of_month: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}.</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Uhrzeit</Label>
                    <Input
                      type="time"
                      value={connection.backup_time}
                      onChange={(e) => updateConnection({ backup_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Datei-Präfix</Label>
                    <Input
                      value={connection.backup_file_prefix}
                      onChange={(e) => updateConnection({ backup_file_prefix: e.target.value })}
                      placeholder="XpenzAI-Backup"
                    />
                  </div>
                </div>

                {/* Content Options */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Backup-Inhalte</Label>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>PDF-Dateien einschließen</Label>
                      <p className="text-xs text-muted-foreground">Original-Belege (umbenannt) in das Backup-Archiv packen</p>
                    </div>
                    <Switch
                      checked={connection.backup_include_files}
                      onCheckedChange={(checked) => updateConnection({ backup_include_files: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Ausgangsrechnungen einschließen</Label>
                      <p className="text-xs text-muted-foreground">Rechnungs-PDFs und -Daten mit sichern</p>
                    </div>
                    <Switch
                      checked={(connection as any).backup_include_invoices ?? false}
                      onCheckedChange={(checked) => updateConnection({ backup_include_invoices: checked } as any)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Excel-Export (.xlsx)</Label>
                      <p className="text-xs text-muted-foreground">Zusammenfassung als Excel-Datei nach Vorlage</p>
                    </div>
                    <Switch
                      checked={connection.backup_include_excel}
                      onCheckedChange={(checked) => updateConnection({ backup_include_excel: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>CSV-Export (.csv)</Label>
                      <p className="text-xs text-muted-foreground">Zusammenfassung als CSV-Datei nach Vorlage</p>
                    </div>
                    <Switch
                      checked={connection.backup_include_csv}
                      onCheckedChange={(checked) => updateConnection({ backup_include_csv: checked })}
                    />
                  </div>
                </div>

                {/* Export Template Selection */}
                {(connection.backup_include_excel || connection.backup_include_csv) && (
                  <div className="space-y-2">
                    <Label>Export-Vorlage</Label>
                    <Select
                      value={connection.backup_template_id || '__default__'}
                      onValueChange={(value) => updateConnection({ backup_template_id: value === '__default__' ? null : value === '__none__' ? null : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vorlage wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Standard (alle Felder)</SelectItem>
                        <SelectItem value="__none__">Keine Zusammenfassung</SelectItem>
                        {!templatesLoading && templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}{t.is_default ? ' ⭐' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Vorlagen können unter Einstellungen → Export verwaltet werden
                    </p>
                  </div>
                )}

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Belege mit folgendem Status sichern</Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(opt => (
                      <Badge
                        key={opt.value}
                        variant={connection.backup_status_filter.includes(opt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleStatusFilter(opt.value)}
                      >
                        {connection.backup_status_filter.includes(opt.value) && <Check className="h-3 w-3 mr-1" />}
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Incremental Backup Info */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Inkrementelles Backup:</span> Nur Belege die noch nie per Cloud-Backup gesichert wurden, werden eingeschlossen. Manuelle Exports (Download) sind davon unabhängig.
                  </AlertDescription>
                </Alert>

                {/* ZIP Naming */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>ZIP-Dateiname</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium mb-1">Verfügbare Platzhalter:</p>
                          <div className="space-y-0.5 text-xs">
                            {ZIP_PLACEHOLDERS.map(p => (
                              <div key={p.key}><code>{p.key}</code> — {p.desc}</div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={connection.backup_zip_pattern}
                    onChange={(e) => updateConnection({ backup_zip_pattern: e.target.value })}
                    placeholder="{prefix}_{datum}_{zeit}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vorschau: <code className="bg-muted px-1 py-0.5 rounded">{getZipPreview()}</code>
                  </p>
                </div>

                {/* Folder Structure */}
                <div className="space-y-2">
                  <Label>Ordnerstruktur in Google Drive</Label>
                  <Select
                    value={connection.backup_folder_structure}
                    onValueChange={(value) => updateConnection({ backup_folder_structure: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flach (alles in einen Ordner)</SelectItem>
                      <SelectItem value="monthly">Nach Monat (YYYY/MM/)</SelectItem>
                      <SelectItem value="category">Nach Kategorie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Save Button */}
                <div className="flex gap-2">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Einstellungen speichern
                  </Button>
                  <Button variant="outline" onClick={handleRunBackupNow}>
                    <Cloud className="h-4 w-4 mr-2" />
                    Jetzt Backup starten
                  </Button>
                </div>
              </>
            )}

            {/* Last Backup Status */}
            {connection.last_backup_at && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Letztes Backup:</span>{' '}
                  {format(new Date(connection.last_backup_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  {connection.last_backup_count !== null && ` — ${connection.last_backup_count} Belege`}
                </AlertDescription>
              </Alert>
            )}

            {connection.last_backup_error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Letzter Fehler:</span> {connection.last_backup_error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
