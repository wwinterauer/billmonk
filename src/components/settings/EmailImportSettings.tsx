import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Mail, 
  Copy, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Info,
  ExternalLink,
  Loader2,
  Plus,
  Server,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  FileText,
  Webhook,
} from 'lucide-react';
import { useEmailImport, EmailAccount, EmailAttachment } from '@/hooks/useEmailImport';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AddAccountFormData {
  email_address: string;
  display_name: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
  inbox_folder: string;
  processed_folder: string;
  sync_interval: string;
}

const defaultFormData: AddAccountFormData = {
  email_address: '',
  display_name: '',
  imap_host: '',
  imap_port: 993,
  imap_username: '',
  imap_password: '',
  imap_use_ssl: true,
  inbox_folder: 'INBOX',
  processed_folder: 'Processed',
  sync_interval: 'manual',
};

// Common IMAP presets with help text
const imapPresets: Record<string, { host: string; port: number; helpText: string; helpUrl?: string }> = {
  gmail: { 
    host: 'imap.gmail.com', 
    port: 993,
    helpText: 'Verwenden Sie ein App-Passwort von myaccount.google.com/apppasswords',
    helpUrl: 'https://myaccount.google.com/apppasswords'
  },
  outlook: { 
    host: 'outlook.office365.com', 
    port: 993,
    helpText: 'Verwenden Sie Ihr Microsoft-Passwort oder ein App-Passwort bei aktivierter 2FA',
    helpUrl: 'https://account.microsoft.com/security'
  },
  yahoo: { 
    host: 'imap.mail.yahoo.com', 
    port: 993,
    helpText: 'Generieren Sie ein App-Passwort unter Kontosicherheit',
    helpUrl: 'https://login.yahoo.com/account/security'
  },
  icloud: { 
    host: 'imap.mail.me.com', 
    port: 993,
    helpText: 'Erstellen Sie ein app-spezifisches Passwort auf appleid.apple.com',
    helpUrl: 'https://appleid.apple.com/account/manage'
  },
  gmx: { 
    host: 'imap.gmx.net', 
    port: 993,
    helpText: 'Aktivieren Sie IMAP in den GMX-Einstellungen unter E-Mail → POP3/IMAP',
  },
  webde: { 
    host: 'imap.web.de', 
    port: 993,
    helpText: 'Aktivieren Sie IMAP in den Web.de-Einstellungen unter E-Mail → POP3/IMAP',
  },
};

export const EmailImportSettings: React.FC = () => {
  const {
    emailConnection,
    emailAccounts,
    emailAttachments,
    importHistory,
    isLoading,
    createConnection,
    isCreating,
    toggleConnection,
    isToggling,
    regenerateToken,
    isRegenerating,
    deleteConnection,
    isDeleting,
    addEmailAccount,
    isAddingAccount,
    updateEmailAccount,
    deleteEmailAccount,
    isDeletingAccount,
    syncEmailAccount,
    isSyncing,
    retryAttachment,
    skipAttachment,
  } = useEmailImport();

  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [formData, setFormData] = useState<AddAccountFormData>(defaultFormData);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
      case 'imported':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Erfolgreich</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" /> Teilweise</Badge>;
      case 'processing':
      case 'running':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Läuft</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Ausstehend</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Fehler</Badge>;
      case 'skipped':
        return <Badge variant="outline"><SkipForward className="h-3 w-3 mr-1" /> Übersprungen</Badge>;
      case 'duplicate':
        return <Badge variant="secondary"><Copy className="h-3 w-3 mr-1" /> Duplikat</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset && imapPresets[preset]) {
      setFormData(prev => ({
        ...prev,
        imap_host: imapPresets[preset].host,
        imap_port: imapPresets[preset].port,
      }));
    }
  };

  const handleAddAccount = () => {
    if (!formData.email_address || !formData.imap_host || !formData.imap_username || !formData.imap_password) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    addEmailAccount(formData);
    setShowAddAccountDialog(false);
    setFormData(defaultFormData);
    setSelectedPreset('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="webhook" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="h-4 w-4" />
            Weiterleitung
          </TabsTrigger>
          <TabsTrigger value="imap" className="gap-2">
            <Server className="h-4 w-4" />
            IMAP-Konten
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-2">
            <FileText className="h-4 w-4" />
            Anhänge
          </TabsTrigger>
        </TabsList>

        {/* Webhook Tab */}
        <TabsContent value="webhook">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                E-Mail-Weiterleitung
              </CardTitle>
              <CardDescription>
                Leiten Sie Rechnungen per E-Mail weiter und sie werden automatisch verarbeitet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!emailConnection ? (
                <div className="text-center py-8 space-y-4">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">E-Mail-Weiterleitung aktivieren</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sie erhalten eine eindeutige E-Mail-Adresse, an die Sie Rechnungen weiterleiten können
                    </p>
                  </div>
                  <Button onClick={() => createConnection()} disabled={isCreating}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    E-Mail-Weiterleitung aktivieren
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Status</Label>
                        <p className="text-sm text-muted-foreground">
                          {emailConnection.is_active ? 'Aktiv - E-Mails werden verarbeitet' : 'Pausiert - E-Mails werden ignoriert'}
                        </p>
                      </div>
                      <Switch
                        checked={emailConnection.is_active}
                        onCheckedChange={(checked) => toggleConnection(checked)}
                        disabled={isToggling}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Ihre Import-Adresse</Label>
                      <div className="flex gap-2">
                        <Input
                          value={emailConnection.import_email}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(emailConnection.import_email)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Leiten Sie Rechnungs-E-Mails an diese Adresse weiter. PDF- und Bildanhänge werden automatisch verarbeitet.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateToken()}
                        disabled={isRegenerating}
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Neue Adresse generieren
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowWebhookInfo(!showWebhookInfo)}
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Webhook-Konfiguration
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deaktivieren
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>E-Mail-Weiterleitung deaktivieren?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ihre Import-Adresse wird gelöscht und kann nicht wiederhergestellt werden. 
                              Bereits importierte Belege bleiben erhalten.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteConnection()}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground"
                            >
                              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Deaktivieren
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {showWebhookInfo && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="space-y-2">
                          <p className="font-medium">Webhook-URL für E-Mail-Service:</p>
                          <div className="flex gap-2">
                            <Input
                              value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-import-webhook`}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-import-webhook`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs">
                            Konfigurieren Sie diese URL bei Ihrem E-Mail-Service (z.B. Postmark, SendGrid, Mailgun) 
                            für Inbound-E-Mail-Webhooks.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                              <a href="https://postmarkapp.com/developer/webhooks/inbound-webhook" target="_blank" rel="noopener noreferrer">
                                Postmark <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                              <a href="https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook" target="_blank" rel="noopener noreferrer">
                                SendGrid <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Importierte Belege</p>
                        <p className="text-2xl font-bold">{emailConnection.import_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Letzter Import</p>
                        <p className="text-2xl font-bold">
                          {emailConnection.last_import_at
                            ? format(new Date(emailConnection.last_import_at), 'dd.MM.yyyy', { locale: de })
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Import History */}
          {emailConnection && importHistory.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Import-Verlauf</CardTitle>
                <CardDescription>Die letzten E-Mail-Importe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Absender</TableHead>
                      <TableHead>Betreff</TableHead>
                      <TableHead>Anhänge</TableHead>
                      <TableHead>Verarbeitet</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importHistory.map((importItem) => (
                      <TableRow key={importItem.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(importItem.received_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {importItem.from_address || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {importItem.subject || '-'}
                        </TableCell>
                        <TableCell>{importItem.attachments_count}</TableCell>
                        <TableCell>{importItem.processed_receipts}</TableCell>
                        <TableCell>{getStatusBadge(importItem.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IMAP Tab */}
        <TabsContent value="imap">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    IMAP-E-Mail-Konten
                  </CardTitle>
                  <CardDescription>
                    Verbinden Sie E-Mail-Konten für automatischen Abruf von Rechnungen
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddAccountDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Konto hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailAccounts.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">Keine IMAP-Konten verbunden</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fügen Sie ein E-Mail-Konto hinzu, um Rechnungen automatisch abzurufen
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {emailAccounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{account.display_name || account.email_address}</p>
                            <p className="text-sm text-muted-foreground">{account.imap_host}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(account.last_sync_status)}
                          <Switch
                            checked={account.is_active}
                            onCheckedChange={(checked) => updateEmailAccount({ id: account.id, is_active: checked })}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Sync-Intervall</p>
                          <p className="font-medium">
                            {account.sync_interval === 'manual' ? 'Manuell' : account.sync_interval}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Importiert</p>
                          <p className="font-medium">{account.total_imported}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Letzter Sync</p>
                          <p className="font-medium">
                            {account.last_sync_at
                              ? format(new Date(account.last_sync_at), 'dd.MM. HH:mm', { locale: de })
                              : '-'}
                          </p>
                        </div>
                      </div>

                      {account.last_sync_error && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>{account.last_sync_error}</AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncEmailAccount(account.id)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Jetzt synchronisieren
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Entfernen
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>E-Mail-Konto entfernen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Das Konto wird getrennt. Bereits importierte Belege bleiben erhalten.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEmailAccount(account.id)}
                                disabled={isDeletingAccount}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Entfernen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                E-Mail-Anhänge
              </CardTitle>
              <CardDescription>
                Übersicht aller empfangenen Anhänge und deren Verarbeitungsstatus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailAttachments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">Noch keine Anhänge empfangen</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datei</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Empfangen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailAttachments.map((attachment) => (
                      <TableRow key={attachment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">
                              {attachment.attachment_filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.attachment_content_type}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {attachment.email_subject || attachment.email_from || '-'}
                        </TableCell>
                        <TableCell>
                          {attachment.created_at
                            ? format(new Date(attachment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })
                            : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(attachment.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {attachment.status === 'error' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => retryAttachment(attachment.id)}
                                title="Erneut verarbeiten"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            {(attachment.status === 'pending' || attachment.status === 'error') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => skipAttachment(attachment.id)}
                                title="Überspringen"
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>IMAP-Konto hinzufügen</DialogTitle>
            <DialogDescription>
              Verbinden Sie ein E-Mail-Konto für automatischen Rechnungsabruf
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Anbieter-Vorlage</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen Sie einen Anbieter..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                  <SelectItem value="yahoo">Yahoo</SelectItem>
                  <SelectItem value="icloud">iCloud</SelectItem>
                  <SelectItem value="gmx">GMX</SelectItem>
                  <SelectItem value="webde">Web.de</SelectItem>
                </SelectContent>
              </Select>
              {selectedPreset && imapPresets[selectedPreset] && (
                <Alert className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {imapPresets[selectedPreset].helpText}
                    {imapPresets[selectedPreset].helpUrl && (
                      <Button variant="link" size="sm" className="h-auto p-0 ml-1" asChild>
                        <a href={imapPresets[selectedPreset].helpUrl} target="_blank" rel="noopener noreferrer">
                          Anleitung <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, email_address: e.target.value }))}
                  placeholder="ihre@email.de"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Anzeigename</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Geschäftskonto"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="imap_host">IMAP-Server *</Label>
                <Input
                  id="imap_host"
                  value={formData.imap_host}
                  onChange={(e) => setFormData(prev => ({ ...prev, imap_host: e.target.value }))}
                  placeholder="imap.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap_port">Port *</Label>
                <Input
                  id="imap_port"
                  type="number"
                  value={formData.imap_port}
                  onChange={(e) => setFormData(prev => ({ ...prev, imap_port: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imap_username">Benutzername *</Label>
                <Input
                  id="imap_username"
                  value={formData.imap_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, imap_username: e.target.value }))}
                  placeholder="ihre@email.de"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap_password">Passwort *</Label>
                <Input
                  id="imap_password"
                  type="password"
                  value={formData.imap_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, imap_password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync_interval">Synchronisierungs-Intervall</Label>
              <Select 
                value={formData.sync_interval} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, sync_interval: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuell</SelectItem>
                  <SelectItem value="5min">Alle 5 Minuten</SelectItem>
                  <SelectItem value="15min">Alle 15 Minuten</SelectItem>
                  <SelectItem value="30min">Alle 30 Minuten</SelectItem>
                  <SelectItem value="1hour">Stündlich</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Für Gmail und andere Anbieter benötigen Sie möglicherweise ein App-Passwort 
                anstelle Ihres regulären Passworts.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddAccount} disabled={isAddingAccount}>
              {isAddingAccount && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Konto hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
