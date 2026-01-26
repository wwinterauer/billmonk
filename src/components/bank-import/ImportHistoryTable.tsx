import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Trash2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface BankImport {
  id: string;
  file_name: string | null;
  imported_rows: number | null;
  date_from: string | null;
  date_to: string | null;
  created_at: string | null;
}

export function ImportHistoryTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState<BankImport | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);

  // Fetch import history
  const { data: imports, isLoading } = useQuery({
    queryKey: ['bank-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as BankImport[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (importId: string) => {
      // First delete all related transactions
      const { error: txError } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('import_batch_id', importId);
      
      if (txError) throw txError;

      // Then delete the import record
      const { error: importError } = await supabase
        .from('bank_imports')
        .delete()
        .eq('id', importId);
      
      if (importError) throw importError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-imports'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      toast({
        title: 'Import gelöscht',
        description: 'Der Import und alle zugehörigen Buchungen wurden gelöscht.',
      });
      setDeleteDialogOpen(false);
      setSelectedImport(null);
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteClick = async (bankImport: BankImport) => {
    setSelectedImport(bankImport);
    
    // Get count of related transactions
    const { count } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', bankImport.id);
    
    setTransactionCount(count || 0);
    setDeleteDialogOpen(true);
  };

  const formatDateRange = (dateFrom: string | null, dateTo: string | null) => {
    if (!dateFrom && !dateTo) return '–';
    if (!dateFrom) return `bis ${format(new Date(dateTo!), 'dd.MM.yyyy', { locale: de })}`;
    if (!dateTo) return `ab ${format(new Date(dateFrom), 'dd.MM.yyyy', { locale: de })}`;
    return `${format(new Date(dateFrom), 'dd.MM.yyyy', { locale: de })} - ${format(new Date(dateTo), 'dd.MM.yyyy', { locale: de })}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Letzte Importe</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Letzte Importe</CardTitle>
        </CardHeader>
        <CardContent>
          {!imports || imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Noch keine Importe vorhanden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead className="text-right">Importiert</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((bankImport) => (
                  <TableRow key={bankImport.id}>
                    <TableCell className="whitespace-nowrap">
                      {bankImport.created_at 
                        ? format(new Date(bankImport.created_at), 'dd.MM.yyyy HH:mm', { locale: de })
                        : '–'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={bankImport.file_name || ''}>
                      {bankImport.file_name || '–'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {bankImport.imported_rows ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateRange(bankImport.date_from, bankImport.date_to)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteClick(bankImport)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du diesen Import und {transactionCount} zugehörige Buchungen wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedImport && deleteMutation.mutate(selectedImport.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lösche...
                </>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
