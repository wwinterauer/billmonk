import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LIMITS } from '@/lib/planConfig';
import { Building2, Plus, RefreshCw, Trash2, Search, Loader2, CheckCircle, AlertTriangle, Landmark, Info } from 'lucide-react';
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

interface BankConnection {
  id: string;
  institution_id: string | null;
  institution_name: string | null;
  institution_logo: string | null;
  iban: string | null;
  status: string;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  requisition_id: string | null;
  account_id: string | null;
}

interface Institution {
  id: string;
  name: string;
  logo: string;
  countries: string[];
}

export function LiveBankSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('AT');
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bank_connections_live')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setConnections((data as any) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const searchInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-connect?action=list-institutions&country=${country}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to load institutions');
      const result = await response.json();
      setInstitutions(Array.isArray(result) ? result : []);
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Banken konnten nicht geladen werden. Prüfe die Enable Banking-Konfiguration.',
        variant: 'destructive',
      });
    } finally {
      setLoadingInstitutions(false);
    }
  };

  const handleStartConnection = async (institutionId: string) => {
    setConnecting(true);
    try {
      const redirectUrl = `${window.location.origin}/settings?tab=bank-live&eb_callback=true`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-connect?action=create-requisition`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ institution_id: institutionId, redirect_url: redirectUrl }),
        }
      );
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      if (result.link) {
        window.location.href = result.link;
      }
    } catch (err) {
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Verbindung konnte nicht gestartet werden.',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  // Handle callback from Enable Banking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('eb_callback') === 'true') {
      const code = params.get('code');
      const finalize = async () => {
        if (code) {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-connect?action=callback`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ code }),
            }
          );
          const result = await response.json();
          if (result.status === 'active') {
            toast({ title: 'Bankkonto verbunden!', description: 'Die Verbindung wurde erfolgreich hergestellt.' });
          }
        }
        fetchConnections();
        window.history.replaceState({}, '', '/settings?tab=bank-live');
      };
      finalize();
    }
  }, [user]);

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-bank-live`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connection_id: connectionId }),
        }
      );
      const result = await response.json();
      toast({
        title: 'Sync abgeschlossen',
        description: `${result.synced || 0} neue Transaktionen synchronisiert.`,
      });
      fetchConnections();
    } catch {
      toast({ title: 'Sync fehlgeschlagen', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (connectionId: string) => {
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-connect?action=delete-connection`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connection_id: connectionId }),
        }
      );
      toast({ title: 'Verbindung gelöscht' });
      fetchConnections();
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConnections = connections.filter((c) => c.status === 'active');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Live-Bankanbindung
          </CardTitle>
          <CardDescription>
            Verbinde dein Bankkonto direkt per Open Banking. Transaktionen werden automatisch synchronisiert
            und mit deinen Belegen und Rechnungen abgeglichen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : activeConnections.length > 0 ? (
            <div className="space-y-3">
              {activeConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {conn.institution_logo ? (
                      <img src={conn.institution_logo} alt="" className="h-8 w-8 rounded" />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{conn.institution_name || 'Bankkonto'}</p>
                      {conn.iban && (
                        <p className="text-sm text-muted-foreground">
                          {conn.iban.replace(/(.{4})/g, '$1 ').trim()}
                        </p>
                      )}
                      {conn.last_sync_at && (
                        <p className="text-xs text-muted-foreground">
                          Letzter Sync: {new Date(conn.last_sync_at).toLocaleString('de-AT')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.sync_error && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fehler
                      </Badge>
                    )}
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktiv
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncing === conn.id}
                    >
                      {syncing === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Verbindung trennen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Die Bankverbindung wird getrennt. Bereits synchronisierte Transaktionen bleiben erhalten.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(conn.id)}>
                            Trennen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Noch keine Bankverbindung eingerichtet</p>
            </div>
          )}

          {!showSearch ? (
            <Button onClick={() => { setShowSearch(true); searchInstitutions(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Bankkonto verbinden
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bank auswählen</CardTitle>
                <div className="flex gap-2">
                  <Select value={country} onValueChange={(v) => { setCountry(v); }}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AT">🇦🇹 AT</SelectItem>
                      <SelectItem value="DE">🇩🇪 DE</SelectItem>
                      <SelectItem value="CH">🇨🇭 CH</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Bank suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => searchInstitutions()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSearch(false)}>
                    Abbrechen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInstitutions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredInstitutions.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {filteredInstitutions.slice(0, 50).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => handleStartConnection(inst.id)}
                        disabled={connecting}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        {inst.logo ? (
                          <img src={inst.logo} alt="" className="h-8 w-8 rounded object-contain" />
                        ) : (
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">{inst.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Banken gefunden
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
