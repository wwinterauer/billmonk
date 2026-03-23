import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, XCircle, Mail, FileWarning } from 'lucide-react';
import { format } from 'date-fns';

interface SystemHealthProps {
  data: {
    error_receipts: Array<{
      id: string;
      file_name: string;
      status: string;
      created_at: string;
      user_email: string;
    }>;
    error_receipts_count: number;
    email_sync_errors: Array<{
      id: string;
      email_address: string;
      last_sync_error: string;
      last_sync_attempt: string;
    }>;
    email_sync_error_count: number;
  } | null;
  loading: boolean;
}

export function SystemHealth({ data, loading }: SystemHealthProps) {
  if (loading) {
    return <div className="text-muted-foreground text-sm">Lade System-Health-Daten...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fehlgeschlagene Extraktionen</CardTitle>
            <FileWarning className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.error_receipts_count}</div>
            <p className="text-xs text-muted-foreground">Belege mit Status "error"</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">E-Mail-Sync-Fehler</CardTitle>
            <Mail className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.email_sync_error_count}</div>
            <p className="text-xs text-muted-foreground">Konten mit Sync-Fehlern</p>
          </CardContent>
        </Card>
      </div>

      {data.error_receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Letzte fehlgeschlagene Belege
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Dateiname</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.error_receipts.slice(0, 20).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">{r.user_email}</TableCell>
                    <TableCell className="text-sm font-mono">{r.file_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.email_sync_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              E-Mail-Sync-Fehler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail-Adresse</TableHead>
                  <TableHead>Letzter Versuch</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.email_sync_errors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.email_address}</TableCell>
                    <TableCell className="text-sm">
                      {e.last_sync_attempt
                        ? format(new Date(e.last_sync_attempt), 'dd.MM.yyyy HH:mm')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-destructive max-w-xs truncate">
                      {e.last_sync_error || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.error_receipts.length === 0 && data.email_sync_errors.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            ✅ Keine Fehler gefunden — alles läuft rund!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
