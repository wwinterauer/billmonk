import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Mail, 
  Copy, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Info,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useEmailImport } from '@/hooks/useEmailImport';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export const EmailImportSettings: React.FC = () => {
  const {
    emailConnection,
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
  } = useEmailImport();

  const [showWebhookInfo, setShowWebhookInfo] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Erfolgreich</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" /> Teilweise</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In Bearbeitung</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Fehlgeschlagen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-Mail-Import
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
                <h3 className="font-medium">E-Mail-Import aktivieren</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Sie erhalten eine eindeutige E-Mail-Adresse, an die Sie Rechnungen weiterleiten können
                </p>
              </div>
              <Button onClick={() => createConnection()} disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                E-Mail-Import aktivieren
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
                        <AlertDialogTitle>E-Mail-Import deaktivieren?</AlertDialogTitle>
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
                        <Button variant="link" size="sm" className="h-auto p-0" asChild>
                          <a href="https://documentation.mailgun.com/en/latest/user_manual.html#receiving-forwarding-and-storing-messages" target="_blank" rel="noopener noreferrer">
                            Mailgun <ExternalLink className="h-3 w-3 ml-1" />
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

      {emailConnection && importHistory.length > 0 && (
        <Card>
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
    </div>
  );
};
