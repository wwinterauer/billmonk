import { useState, useCallback } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { motion } from 'framer-motion';
import {
  FileSpreadsheet,
  X,
  Download,
  Upload,
  Search,
  Link,
  Info,
  Building2,
  Calendar,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { parseCsvFile, ParsedTransaction, ParseResult } from '@/hooks/useBankImport';
import { ImportPreviewModal } from '@/components/bank-import/ImportPreviewModal';
import { ImportResultDialog } from '@/components/bank-import/ImportResultDialog';
import { ImportHistoryTable } from '@/components/bank-import/ImportHistoryTable';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const banks = [
  { value: 'erste-sparkasse', label: 'Erste Bank / Sparkasse' },
  { value: 'raiffeisen', label: 'Raiffeisen' },
  { value: 'bank-austria', label: 'Bank Austria' },
  { value: 'bawag', label: 'BAWAG' },
  { value: 'easybank', label: 'Easybank' },
  { value: 'n26', label: 'N26' },
  { value: 'other', label: 'Andere (manuelles Mapping)' },
];

const steps = [
  { icon: Download, text: 'Lade den Kontoauszug als CSV aus deinem Online-Banking' },
  { icon: Upload, text: 'Wähle die CSV-Datei hier aus' },
  { icon: Building2, text: 'Wähle deine Bank für korrektes Format' },
  { icon: Search, text: 'BillMonk analysiert die Buchungen' },
  { icon: Link, text: 'Gleiche Buchungen mit Belegen ab' },
];

export default function BankImport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [onlyExpenses, setOnlyExpenses] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createNoReceiptEntries, setCreateNoReceiptEntries] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | undefined>();
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importResult, setImportResult] = useState({
    imported: 0,
    skippedIncome: 0,
    skippedDuplicates: 0,
    possibleMatches: 0,
    noReceiptEntries: 0,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      if (droppedFile.size <= 5 * 1024 * 1024) {
        setFile(droppedFile);
      } else {
        toast({
          title: 'Datei zu groß',
          description: 'Die maximale Dateigröße beträgt 5MB.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Ungültiges Format',
        description: 'Bitte lade eine CSV-Datei hoch.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size <= 5 * 1024 * 1024) {
        setFile(selectedFile);
      } else {
        toast({
          title: 'Datei zu groß',
          description: 'Die maximale Dateigröße beträgt 5MB.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParseResult(null);
  };

  // Check for duplicates in database
  const checkDuplicates = async (transactions: ParsedTransaction[]): Promise<number> => {
    if (!user?.id || transactions.length === 0) return 0;
    
    let duplicates = 0;
    
    // Check in batches to avoid too many queries
    for (const tx of transactions) {
      const { count } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('transaction_date', format(tx.date, 'yyyy-MM-dd'))
        .eq('amount', tx.amount)
        .eq('description', tx.description);
      
      if (count && count > 0) duplicates++;
    }
    
    return duplicates;
  };

  // Parse CSV and show preview
  const handleParseAndPreview = async () => {
    if (!file || !selectedBank) return;
    
    setIsParsing(true);
    
    try {
      const result = await parseCsvFile(file, selectedBank);
      
      if (!result.success && result.transactions.length === 0) {
        toast({
          title: 'Datei konnte nicht gelesen werden',
          description: result.errors[0] || 'Unbekannter Fehler beim Parsen.',
          variant: 'destructive',
        });
        setIsParsing(false);
        return;
      }
      
      // Filter by date range if specified
      let filteredTransactions = result.transactions;
      if (dateFrom) {
        filteredTransactions = filteredTransactions.filter(t => t.date >= dateFrom);
      }
      if (dateTo) {
        filteredTransactions = filteredTransactions.filter(t => t.date <= dateTo);
      }
      
      const filteredResult: ParseResult = {
        ...result,
        transactions: filteredTransactions,
        totalRows: filteredTransactions.length,
        expenses: filteredTransactions.filter(t => t.isExpense).length,
        income: filteredTransactions.filter(t => !t.isExpense).length,
      };
      
      setParseResult(filteredResult);
      
      // Check for duplicates if option is enabled
      let duplicates = 0;
      if (skipDuplicates) {
        duplicates = await checkDuplicates(filteredTransactions.filter(t => !onlyExpenses || t.isExpense));
        setDuplicateCount(duplicates);
      }
      
      setShowPreviewModal(true);
    } catch (error) {
      toast({
        title: 'Fehler beim Lesen',
        description: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Import transactions to database
  const handleConfirmImport = async () => {
    if (!parseResult || !user?.id || !file) return;
    
    setIsImporting(true);
    
    try {
      // Filter transactions based on options
      let transactionsToImport = parseResult.transactions;
      if (onlyExpenses) {
        transactionsToImport = transactionsToImport.filter(t => t.isExpense);
      }
      
      const total = transactionsToImport.length;
      let imported = 0;
      let skippedDuplicates = 0;
      let noReceiptEntriesCreated = 0;
      const skippedIncome = onlyExpenses ? parseResult.income : 0;
      
      // Load active keywords for auto-creation of no-receipt entries
      const { data: keywords } = await supabase
        .from('bank_import_keywords')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      // Create import batch record first
      const dateFromValue = transactionsToImport.length > 0
        ? format(new Date(Math.min(...transactionsToImport.map(t => t.date.getTime()))), 'yyyy-MM-dd')
        : null;
      const dateToValue = transactionsToImport.length > 0
        ? format(new Date(Math.max(...transactionsToImport.map(t => t.date.getTime()))), 'yyyy-MM-dd')
        : null;
      
      const { data: importBatch, error: batchError } = await supabase
        .from('bank_imports')
        .insert({
          user_id: user.id,
          file_name: file.name,
          total_rows: parseResult.totalRows,
          date_from: dateFromValue,
          date_to: dateToValue,
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Import transactions
      for (let i = 0; i < transactionsToImport.length; i++) {
        const tx = transactionsToImport[i];
        setImportProgress({ current: i + 1, total });
        
        // Check for duplicate if enabled
        if (skipDuplicates) {
          const { count } = await supabase
            .from('bank_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('transaction_date', format(tx.date, 'yyyy-MM-dd'))
            .eq('amount', tx.amount)
            .eq('description', tx.description);
          
          if (count && count > 0) {
            skippedDuplicates++;
            continue;
          }
        }
        
        // Insert transaction
        const { data: insertedTx, error: txError } = await supabase
          .from('bank_transactions')
          .insert({
            user_id: user.id,
            transaction_date: format(tx.date, 'yyyy-MM-dd'),
            value_date: tx.valueDate ? format(tx.valueDate, 'yyyy-MM-dd') : null,
            description: tx.description,
            amount: tx.amount,
            is_expense: tx.isExpense,
            status: 'unmatched',
            import_batch_id: importBatch.id,
            raw_data: tx.rawData,
          })
          .select()
          .single();
        
        if (txError) {
          console.error('Transaction insert error:', txError);
          continue;
        }
        
        imported++;
        
        // Check for keyword match and create no-receipt entry if enabled
        if (createNoReceiptEntries && tx.isExpense && keywords && keywords.length > 0) {
          const matchedKeyword = keywords.find(kw => 
            tx.description.toLowerCase().includes(kw.keyword.toLowerCase())
          );
          
          if (matchedKeyword) {
            // Create receipt entry without physical receipt
            const { error: receiptError } = await supabase
              .from('receipts')
              .insert({
                user_id: user.id,
                vendor: matchedKeyword.keyword,
                description: matchedKeyword.description_template || tx.description,
                amount_gross: tx.amount,
                receipt_date: format(tx.date, 'yyyy-MM-dd'),
                category: matchedKeyword.category,
                vat_rate: matchedKeyword.tax_rate || 0,
                status: 'approved',
                source: 'bank_import',
                is_no_receipt_entry: true,
                bank_import_keyword_id: matchedKeyword.id,
                bank_transaction_reference: tx.description,
                bank_transaction_id: insertedTx?.id,
                notes: 'Automatisch erstellt aus Bankbuchung - Keine Rechnung vorhanden',
              });
            
            if (!receiptError) {
              noReceiptEntriesCreated++;
              
              // Update transaction status to matched
              await supabase
                .from('bank_transactions')
                .update({ status: 'matched' })
                .eq('id', insertedTx.id);
            }
          }
        }
      }
      
      // Update import batch with final counts
      await supabase
        .from('bank_imports')
        .update({
          imported_rows: imported,
          skipped_rows: skippedDuplicates + skippedIncome,
        })
        .eq('id', importBatch.id);
      
      // Check for possible matches with receipts
      const { count: matchCount } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('bank_transaction_id', null);
      
      setImportResult({
        imported,
        skippedIncome,
        skippedDuplicates,
        possibleMatches: matchCount || 0,
        noReceiptEntries: noReceiptEntriesCreated,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['bank-imports'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      
      setShowPreviewModal(false);
      setShowResultDialog(true);
      
    } catch (error) {
      toast({
        title: 'Import fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(undefined);
    }
  };

  const handleImportAnother = () => {
    setShowResultDialog(false);
    setFile(null);
    setSelectedBank('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setParseResult(null);
    setDuplicateCount(0);
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="bankImport">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-foreground">Kontoauszug importieren</h1>
          <p className="text-muted-foreground mt-1">
            Lade deinen Kontoauszug als CSV hoch, um Ausgaben automatisch mit Belegen abzugleichen
          </p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - 60% */}
          <div className="lg:col-span-3 space-y-6">
            {/* CSV Upload Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CSV-Datei hochladen</CardTitle>
                </CardHeader>
                <CardContent>
                  {!file ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={cn(
                        'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                        isDragging
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileSpreadsheet className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-medium">CSV-Datei hierher ziehen</p>
                          <p className="text-muted-foreground mt-1">oder</p>
                        </div>
                        <label>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <Button variant="outline" className="cursor-pointer" asChild>
                            <span>Datei auswählen</span>
                          </Button>
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Unterstützte Formate: CSV, max. 5MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Import Settings Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import-Einstellungen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Bank Selection */}
                  <div className="space-y-2">
                    <Label>
                      Bank auswählen <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.value} value={bank.value}>
                            {bank.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Für automatische Formaterkennung
                    </p>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="only-expenses"
                        checked={onlyExpenses}
                        onCheckedChange={(checked) => setOnlyExpenses(checked as boolean)}
                      />
                      <Label htmlFor="only-expenses" className="cursor-pointer">
                        Nur Ausgaben importieren (Abbuchungen)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="skip-duplicates"
                        checked={skipDuplicates}
                        onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                      />
                      <Label htmlFor="skip-duplicates" className="cursor-pointer">
                        Bereits importierte Buchungen überspringen
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="create-no-receipt-entries"
                        checked={createNoReceiptEntries}
                        onCheckedChange={(checked) => setCreateNoReceiptEntries(checked as boolean)}
                      />
                      <Label htmlFor="create-no-receipt-entries" className="cursor-pointer">
                        Bankgebühren/Versicherungen automatisch erfassen
                      </Label>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label>Zeitraum einschränken (optional)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Von</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !dateFrom && 'text-muted-foreground'
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, 'dd.MM.yyyy', { locale: de }) : 'Datum wählen'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Bis</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !dateTo && 'text-muted-foreground'
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: de }) : 'Datum wählen'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {/* Import Button */}
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleParseAndPreview}
                    disabled={isParsing || !file || !selectedBank}
                  >
                    {isParsing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                        Analysiere...
                      </>
                    ) : (
                      'Importieren'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Import History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <ImportHistoryTable />
            </motion.div>
          </div>

          {/* Right Column - 40% */}
          <div className="lg:col-span-2 space-y-6">
            {/* How it works Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">So funktioniert's</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {steps.map((step, index) => (
                      <li key={index} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <step.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 pt-1">
                          <span className="text-sm">{step.text}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </motion.div>

            {/* Supported Banks Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Unterstützte Banken</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {banks.slice(0, -1).map((bank) => (
                      <li
                        key={bank.value}
                        className="flex items-center gap-2"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{bank.label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    Deine Bank fehlt?{' '}
                    <a href="mailto:support@billmonk.ai" className="text-primary hover:underline">
                      Kontaktiere uns
                    </a>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {parseResult && (
        <ImportPreviewModal
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          parseResult={parseResult}
          onlyExpenses={onlyExpenses}
          skipDuplicates={skipDuplicates}
          duplicateCount={duplicateCount}
          onConfirmImport={handleConfirmImport}
          isImporting={isImporting}
          importProgress={importProgress}
        />
      )}

      {/* Import Result Dialog */}
      <ImportResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        result={importResult}
        onImportAnother={handleImportAnother}
      />
      </FeatureGate>
    </DashboardLayout>
  );
}
