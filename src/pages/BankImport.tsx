import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FileSpreadsheet, 
  X, 
  Download, 
  Upload, 
  Sparkles, 
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
import { ImportResultDialog } from '@/components/bank-import/ImportResultDialog';

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
  { icon: Sparkles, text: 'XpenzAi analysiert die Buchungen' },
  { icon: Link, text: 'Gleiche Buchungen mit Belegen ab' },
];

export default function BankImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [onlyExpenses, setOnlyExpenses] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isImporting, setIsImporting] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importResult, setImportResult] = useState({
    totalTransactions: 0,
    expenses: 0,
    income: 0,
    possibleMatches: 0,
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
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte lade zuerst eine CSV-Datei hoch.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedBank) {
      toast({
        title: 'Bank nicht ausgewählt',
        description: 'Bitte wähle deine Bank aus.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    // Simulate import process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock result
    setImportResult({
      totalTransactions: 42,
      expenses: 38,
      income: 4,
      possibleMatches: 12,
    });

    setIsImporting(false);
    setShowResultDialog(true);
  };

  const handleImportAnother = () => {
    setShowResultDialog(false);
    setFile(null);
    setSelectedBank('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
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
                    onClick={handleImport}
                    disabled={isImporting || !file || !selectedBank}
                  >
                    {isImporting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                        Importiere...
                      </>
                    ) : (
                      'Importieren'
                    )}
                  </Button>
                </CardContent>
              </Card>
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
                    <a href="mailto:support@xpenzai.com" className="text-primary hover:underline">
                      Kontaktiere uns
                    </a>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Import Result Dialog */}
      <ImportResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        result={importResult}
        onImportAnother={handleImportAnother}
      />
    </DashboardLayout>
  );
}
