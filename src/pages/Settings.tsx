import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Save, 
  FileText, 
  Tag,
  Calendar,
  DollarSign,
  FolderOpen,
  Hash,
  File,
  Info,
  Loader2,
  Receipt,
  CreditCard,
  Tags,
  Building,
  Building2,
  Table2,
  Sparkles,
  Brain,
  Mail,
  Landmark,
  Cloud,
  Lock,
  Package,
  FileCheck,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { VendorManagement } from '@/components/settings/VendorManagement';
import { ExportTemplateSettings } from '@/components/settings/ExportTemplateSettings';
import { DescriptionSettings } from '@/components/settings/DescriptionSettings';
import { AILearningSettings } from '@/components/settings/AILearningSettings';
import { ProcessingRetry } from '@/components/settings/ProcessingRetry';
import { EmailImportSettings } from '@/components/settings/EmailImportSettings';
import { BankImportKeywords } from '@/components/settings/BankImportKeywords';
import { TagManagement } from '@/components/settings/TagManagement';
import { CloudStorageSettings } from '@/components/settings/CloudStorageSettings';
import { CustomerManagement } from '@/components/settings/CustomerManagement';
import { InvoiceItemManagement } from '@/components/settings/InvoiceItemManagement';
import { InvoiceTemplateSettings } from '@/components/settings/InvoiceTemplateSettings';
import { QuoteTemplateSettings } from '@/components/settings/QuoteTemplateSettings';
import { InvoiceModuleSettings } from '@/components/settings/InvoiceModuleSettings';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { LiveBankSettings } from '@/components/settings/LiveBankSettings';
import { usePlan } from '@/hooks/usePlan';
import { FEATURE_MIN_PLAN, isPlanSufficient } from '@/lib/planConfig';
import { FeatureGate } from '@/components/FeatureGate';
import type { Json } from '@/integrations/supabase/types';

interface NamingSettings {
  template: string;
  replaceUmlauts: boolean;
  replaceSpaces: 'none' | 'underscore' | 'hyphen';
  removeSpecialChars: boolean;
  lowercase: boolean;
  dateFormat: string;
  emptyFieldHandling: 'keep' | 'replace' | 'remove';
}

const DEFAULT_SETTINGS: NamingSettings = {
  template: '{datum}_{lieferant}_{betrag}',
  replaceUmlauts: true,
  replaceSpaces: 'underscore',
  removeSpecialChars: true,
  lowercase: false,
  dateFormat: 'YYYYMMDD',
  emptyFieldHandling: 'remove',
};

interface PlaceholderGroup {
  title: string;
  placeholders: {
    key: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    title: 'Datum',
    placeholders: [
      { key: '{datum}', label: 'Datum', description: 'Belegdatum (Format laut Einstellung)', icon: Calendar },
      { key: '{jahr}', label: 'Jahr', description: 'Jahr 4-stellig (2024)', icon: Calendar },
      { key: '{jahr2}', label: 'Jahr 2-St.', description: 'Jahr 2-stellig (24)', icon: Calendar },
      { key: '{monat}', label: 'Monat', description: 'Monat 2-stellig (01-12)', icon: Calendar },
      { key: '{tag}', label: 'Tag', description: 'Tag 2-stellig (01-31)', icon: Calendar },
    ],
  },
  {
    title: 'Beleg-Infos',
    placeholders: [
      { key: '{lieferant}', label: 'Lieferant', description: 'Name des Lieferanten', icon: Tag },
      { key: '{betrag}', label: 'Betrag', description: 'Bruttobetrag (z.B. 125.50)', icon: DollarSign },
      { key: '{betrag_int}', label: 'Betrag Int', description: 'Bruttobetrag ohne Dezimal (z.B. 12550)', icon: DollarSign },
      { key: '{kategorie}', label: 'Kategorie', description: 'Kategorie des Belegs', icon: FolderOpen },
      { key: '{rechnungsnummer}', label: 'Rechnungs-Nr.', description: 'Rechnungsnummer (falls vorhanden)', icon: Receipt },
      { key: '{zahlungsart}', label: 'Zahlungsart', description: 'Zahlungsart des Belegs', icon: CreditCard },
    ],
  },
  {
    title: 'System',
    placeholders: [
      { key: '{nummer}', label: 'Nummer', description: 'Fortlaufende Nummer (001, 002, ...)', icon: Hash },
      { key: '{original}', label: 'Original', description: 'Original-Dateiname (ohne Endung)', icon: File },
    ],
  },
];

const DATE_FORMATS = [
  { value: 'YYYYMMDD', label: 'YYYYMMDD', example: '20240115' },
  { value: 'YYMMDD', label: 'YYMMDD', example: '240115' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-01-15' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '15.01.2024' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '15-01-2024' },
  { value: 'DD.MM.YY', label: 'DD.MM.YY', example: '15.01.24' },
];

const EMPTY_FIELD_OPTIONS = [
  { value: 'keep', label: 'Platzhalter leer lassen' },
  { value: 'replace', label: "Platzhalter mit 'k.A.' ersetzen" },
  { value: 'remove', label: 'Platzhalter komplett entfernen' },
];

// Example data for preview
const EXAMPLE_DATA_FULL = {
  datum: '2024-01-15',
  lieferant: 'Müller GmbH',
  betrag: 125.50,
  kategorie: 'Büromaterial',
  rechnungsnummer: 'RE-2024-001',
  zahlungsart: 'Überweisung',
  original: 'Rechnung_2024',
};

const EXAMPLE_DATA_PARTIAL = {
  datum: '2024-01-20',
  lieferant: 'Amazon',
  betrag: 45.99,
  kategorie: 'Software',
  rechnungsnummer: null,
  zahlungsart: null,
  original: 'scan_001',
};

// Helper to parse replaceSpaces from saved settings (handles backwards compatibility with boolean)
const parseReplaceSpaces = (value: unknown): NamingSettings['replaceSpaces'] => {
  if (value === 'underscore' || value === 'hyphen' || value === 'none') {
    return value;
  }
  // Backwards compatibility: true -> 'underscore', false -> 'none'
  if (typeof value === 'boolean') {
    return value ? 'underscore' : 'none';
  }
  return DEFAULT_SETTINGS.replaceSpaces;
};

const SPACE_REPLACEMENT_OPTIONS = [
  { value: 'none', label: 'Nicht ersetzen', description: 'Leerzeichen beibehalten' },
  { value: 'underscore', label: 'Unterstrich', description: 'Leerzeichen durch _ ersetzen' },
  { value: 'hyphen', label: 'Bindestrich', description: 'Leerzeichen durch - ersetzen' },
];

const Settings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const { effectivePlan } = usePlan();
  
  // Handle tab from URL query parameter - must be before any early returns
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['naming', 'recognition', 'categories', 'tags', 'bank-keywords', 'vendors', 'export', 'ai-learning', 'email-import', 'cloud-storage', 'company', 'customers', 'invoice-items', 'invoice-templates', 'quote-templates', 'invoice-settings'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'naming';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NamingSettings>(DEFAULT_SETTINGS);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('naming_settings')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.naming_settings && typeof data.naming_settings === 'object') {
          const savedSettings = data.naming_settings as Record<string, unknown>;
          setSettings({
            template: (savedSettings.template as string) || DEFAULT_SETTINGS.template,
            replaceUmlauts: savedSettings.replaceUmlauts !== undefined ? Boolean(savedSettings.replaceUmlauts) : DEFAULT_SETTINGS.replaceUmlauts,
            replaceSpaces: parseReplaceSpaces(savedSettings.replaceSpaces),
            removeSpecialChars: savedSettings.removeSpecialChars !== undefined ? Boolean(savedSettings.removeSpecialChars) : DEFAULT_SETTINGS.removeSpecialChars,
            lowercase: savedSettings.lowercase !== undefined ? Boolean(savedSettings.lowercase) : DEFAULT_SETTINGS.lowercase,
            dateFormat: (savedSettings.dateFormat as string) || DEFAULT_SETTINGS.dateFormat,
            emptyFieldHandling: (savedSettings.emptyFieldHandling as NamingSettings['emptyFieldHandling']) || DEFAULT_SETTINGS.emptyFieldHandling,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Save settings to database
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const settingsToSave: Json = {
        template: settings.template,
        replaceUmlauts: settings.replaceUmlauts,
        replaceSpaces: settings.replaceSpaces,
        removeSpecialChars: settings.removeSpecialChars,
        lowercase: settings.lowercase,
        dateFormat: settings.dateFormat,
        emptyFieldHandling: settings.emptyFieldHandling,
      };
      
      const { error } = await supabase
        .from('profiles')
        .update({ naming_settings: settingsToSave })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Einstellungen gespeichert',
        description: 'Deine Umbenennungsregeln wurden aktualisiert.',
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

  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = settings.template;
    
    const newValue = 
      currentValue.substring(0, start) + 
      placeholder + 
      currentValue.substring(end);
    
    setSettings(prev => ({ ...prev, template: newValue }));
    
    // Set cursor position after inserted placeholder
    setTimeout(() => {
      input.focus();
      const newPosition = start + placeholder.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Apply naming transformations
  const applyTransformations = (text: string): string => {
    let result = text;

    if (settings.replaceUmlauts) {
      result = result
        .replace(/ä/g, 'ae')
        .replace(/Ä/g, 'Ae')
        .replace(/ö/g, 'oe')
        .replace(/Ö/g, 'Oe')
        .replace(/ü/g, 'ue')
        .replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss');
    }

    if (settings.replaceSpaces === 'underscore') {
      result = result.replace(/\s+/g, '_');
    } else if (settings.replaceSpaces === 'hyphen') {
      result = result.replace(/\s+/g, '-');
    }

    if (settings.removeSpecialChars) {
      // Keep alphanumeric, underscores, hyphens, and dots
      result = result.replace(/[^a-zA-Z0-9_\-.]/g, '');
    }

    if (settings.lowercase) {
      result = result.toLowerCase();
    }

    // Clean up multiple underscores/hyphens that may result from empty placeholders
    result = result.replace(/[-_]+/g, (match) => match[0]).replace(/^[-_]|[-_]$/g, '');

    return result;
  };

  // Format date according to selected format
  const formatDate = (dateStr: string, format: string): string => {
    const [year, month, day] = dateStr.split('-');
    const year2 = year.slice(2);
    switch (format) {
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'DD.MM.YY':
        return `${day}.${month}.${year2}`;
      case 'YYYYMMDD':
        return `${year}${month}${day}`;
      case 'YYMMDD':
        return `${year2}${month}${day}`;
      case 'YYYY-MM-DD':
      default:
        return dateStr;
    }
  };

  // Get date parts
  const getDateParts = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return { year, year2: year.slice(2), month, day };
  };

  // Handle empty field based on settings
  const handleEmptyField = (value: string | null | undefined, placeholder: string): string => {
    if (value) return value;
    
    switch (settings.emptyFieldHandling) {
      case 'replace':
        return 'k.A.';
      case 'remove':
        return '';
      case 'keep':
      default:
        return '';
    }
  };

  // Generate preview filename
  const generatePreviewFilename = (exampleData: typeof EXAMPLE_DATA_FULL | typeof EXAMPLE_DATA_PARTIAL, index: number): string => {
    let result = settings.template;

    // Date placeholders
    const formattedDate = formatDate(exampleData.datum, settings.dateFormat);
    const dateParts = getDateParts(exampleData.datum);
    
    result = result.replace(/{datum}/g, formattedDate);
    result = result.replace(/{jahr}/g, dateParts.year);
    result = result.replace(/{jahr2}/g, dateParts.year2);
    result = result.replace(/{monat}/g, dateParts.month);
    result = result.replace(/{tag}/g, dateParts.day);

    // Beleg-Info placeholders
    result = result.replace(/{lieferant}/g, handleEmptyField(exampleData.lieferant, '{lieferant}'));
    result = result.replace(/{betrag}/g, exampleData.betrag.toFixed(2));
    result = result.replace(/{betrag_int}/g, Math.round(exampleData.betrag * 100).toString());
    result = result.replace(/{kategorie}/g, handleEmptyField(exampleData.kategorie, '{kategorie}'));
    result = result.replace(/{rechnungsnummer}/g, handleEmptyField(exampleData.rechnungsnummer, '{rechnungsnummer}'));
    result = result.replace(/{zahlungsart}/g, handleEmptyField(exampleData.zahlungsart, '{zahlungsart}'));

    // System placeholders
    result = result.replace(/{nummer}/g, String(index).padStart(3, '0'));
    result = result.replace(/{original}/g, exampleData.original);

    // Apply transformations
    result = applyTransformations(result);

    return result + '.pdf';
  };

  // Generate preview filenames
  const previewFilenames = useMemo(() => {
    return {
      full: generatePreviewFilename(EXAMPLE_DATA_FULL, 1),
      partial: generatePreviewFilename(EXAMPLE_DATA_PARTIAL, 2),
    };
  }, [settings]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const allTabs = [
    { value: 'naming', icon: FileText, label: 'Umbenennung' },
    { value: 'recognition', icon: Sparkles, label: 'Erkennung' },
    { value: 'categories', icon: Tags, label: 'Kategorien' },
    { value: 'tags', icon: Hash, label: 'Tags' },
    { value: 'vendors', icon: Building, label: 'Lieferanten' },
    { value: 'export', icon: Table2, label: 'Export' },
    { value: 'ai-learning', icon: Brain, label: 'KI-Training' },
    { value: 'bank-keywords', icon: Landmark, label: 'Bank', requiredFeature: 'bankImport' as const },
    { value: 'email-import', icon: Mail, label: 'E-Mail', requiredFeature: 'emailImport' as const },
    { value: 'cloud-storage', icon: Cloud, label: 'Cloud', requiredFeature: 'cloudBackup' as const },
    { value: 'company', icon: Building2, label: 'Firma', requiredFeature: 'invoiceModule' as const },
    { value: 'customers', icon: Building2, label: 'Kunden', requiredFeature: 'invoiceModule' as const },
    { value: 'invoice-items', icon: Package, label: 'Artikel', requiredFeature: 'invoiceModule' as const },
    { value: 'invoice-templates', icon: FileCheck, label: 'Rechnung', requiredFeature: 'invoiceModule' as const },
    { value: 'quote-templates', icon: FileText, label: 'Angebot', requiredFeature: 'invoiceModule' as const },
    { value: 'invoice-settings', icon: Settings2, label: 'Fakturierung', requiredFeature: 'invoiceModule' as const },
  ];

  const isTabLocked = (requiredFeature?: string): boolean => {
    if (!requiredFeature) return false;
    const minPlan = FEATURE_MIN_PLAN[requiredFeature];
    if (!minPlan) return false;
    return !isPlanSufficient(effectivePlan, minPlan);
  };

  // Split tabs into expense group and invoice group
  const expenseTabs = allTabs.filter(t => !['company', 'customers', 'invoice-items', 'invoice-templates', 'quote-templates', 'invoice-settings'].includes(t.value));
  const invoiceTabs = allTabs.filter(t => ['company', 'customers', 'invoice-items', 'invoice-templates', 'quote-templates', 'invoice-settings'].includes(t.value));

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };




  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground">Verwalte deine Kontoeinstellungen und Präferenzen</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="space-y-2">
            <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1">
              {expenseTabs.map(tab => {
                const locked = isTabLocked(tab.requiredFeature);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'gap-2 flex-shrink-0',
                      locked && 'opacity-50'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1 bg-primary/5 border border-primary/10">
              {invoiceTabs.map(tab => {
                const locked = isTabLocked(tab.requiredFeature);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'gap-2 flex-shrink-0',
                      locked && 'opacity-50'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </TabsTrigger>
              );
            })}
            </TabsList>
          </div>

          {/* File Naming Tab */}
          <TabsContent value="naming">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Umbenennungsregeln für Beleg-Export</CardTitle>
                      <CardDescription>
                        Definiere wie exportierte Belege benannt werden sollen
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Template Input */}
                  <div className="space-y-3">
                    <Label htmlFor="template">Dateiname-Vorlage</Label>
                    <Input
                      ref={inputRef}
                      id="template"
                      value={settings.template}
                      onChange={(e) => setSettings(prev => ({ ...prev, template: e.target.value }))}
                      placeholder="{datum}_{lieferant}_{betrag}"
                      className="font-mono"
                    />
                
                {/* Placeholder Chips - Grouped */}
                <div className="space-y-4">
                  {PLACEHOLDER_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.placeholders.map((placeholder) => (
                          <Tooltip key={placeholder.key}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => insertPlaceholder(placeholder.key)}
                              >
                                <placeholder.icon className="h-3.5 w-3.5" />
                                {placeholder.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p><strong>{placeholder.key}</strong></p>
                              <p className="text-muted-foreground">{placeholder.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Format */}
              <div className="space-y-3">
                <Label>Datumsformat für {'{datum}'}</Label>
                <Select
                  value={settings.dateFormat}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, dateFormat: value }))}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <span className="font-mono">{format.label}</span>
                        <span className="text-muted-foreground ml-2">({format.example})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <Label>Zusätzliche Optionen</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="replaceUmlauts"
                      checked={settings.replaceUmlauts}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, replaceUmlauts: checked as boolean }))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="replaceUmlauts"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Umlaute ersetzen
                      </label>
                      <p className="text-xs text-muted-foreground">
                        ä→ae, ö→oe, ü→ue, ß→ss
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 col-span-2">
                    <div className="space-y-2 flex-1">
                      <Label>Leerzeichen ersetzen</Label>
                      <Select
                        value={settings.replaceSpaces}
                        onValueChange={(value) => 
                          setSettings(prev => ({ ...prev, replaceSpaces: value as NamingSettings['replaceSpaces'] }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPACE_REPLACEMENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span>{option.label}</span>
                              <span className="text-muted-foreground ml-2 text-xs">({option.description})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="removeSpecialChars"
                      checked={settings.removeSpecialChars}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, removeSpecialChars: checked as boolean }))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="removeSpecialChars"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Sonderzeichen entfernen
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Entfernt alle nicht-alphanumerischen Zeichen
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="lowercase"
                      checked={settings.lowercase}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, lowercase: checked as boolean }))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="lowercase"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Kleinbuchstaben
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Dateinamen in Kleinbuchstaben konvertieren
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empty Field Handling */}
              <div className="space-y-3">
                <Label>Bei leeren Feldern</Label>
                <Select
                  value={settings.emptyFieldHandling}
                  onValueChange={(value: NamingSettings['emptyFieldHandling']) => 
                    setSettings(prev => ({ ...prev, emptyFieldHandling: value }))
                  }
                >
                  <SelectTrigger className="w-[320px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPTY_FIELD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Live-Vorschau</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Zeigt wie Dateien basierend auf deiner Vorlage benannt werden.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="space-y-3">
                  {/* Example 1: All fields present */}
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Beispiel 1: Alle Felder vorhanden
                        </p>
                        <p className="font-mono text-sm break-all text-foreground">{previewFilenames.full}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {EXAMPLE_DATA_FULL.lieferant} | {EXAMPLE_DATA_FULL.datum} | €{EXAMPLE_DATA_FULL.betrag.toFixed(2)} | {EXAMPLE_DATA_FULL.rechnungsnummer}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Example 2: Some fields missing */}
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <FileText className="h-8 w-8 text-yellow-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Beispiel 2: Rechnungsnummer fehlt
                        </p>
                        <p className="font-mono text-sm break-all text-foreground">{previewFilenames.partial}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {EXAMPLE_DATA_PARTIAL.lieferant} | {EXAMPLE_DATA_PARTIAL.datum} | €{EXAMPLE_DATA_PARTIAL.betrag.toFixed(2)} | <span className="italic">keine Rechnungs-Nr.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="min-w-[120px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Recognition Settings Tab */}
      <TabsContent value="recognition">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Beschreibung / Rechnungspositionen</CardTitle>
                  <CardDescription>
                    Einstellungen für die Zusammenfassung der Rechnungspositionen
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DescriptionSettings />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Categories Tab */}
      <TabsContent value="categories">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Tags className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Ausgaben-Kategorien</CardTitle>
                  <CardDescription>
                    Verwalte die Kategorien für deine Belege
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CategoryManagement />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Vendors Tab */}
      <TabsContent value="vendors">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Lieferanten-Verwaltung</CardTitle>
                  <CardDescription>
                    Verwalte erkannte Lieferanten und weise ihnen Standardwerte zu
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <VendorManagement />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Export Templates Tab */}
      <TabsContent value="export">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Table2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Export-Vorlagen</CardTitle>
                  <CardDescription>
                    Konfiguriere das Layout für deine Ausgaben-Exporte
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ExportTemplateSettings />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* AI Learning Tab */}
      <TabsContent value="ai-learning">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Processing Retry */}
          <ProcessingRetry />
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle>KI-Training</CardTitle>
                  <CardDescription>
                    Übersicht und Verwaltung der automatischen Lernfunktion
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AILearningSettings />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Email Import Tab */}
      <TabsContent value="email-import">
        <FeatureGate feature="emailImport">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <EmailImportSettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Bank Keywords Tab */}
      <TabsContent value="bank-keywords">
        <FeatureGate feature="bankImport">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <BankImportKeywords />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Tags Tab */}
      <TabsContent value="tags">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Tags verwalten</CardTitle>
                  <CardDescription>
                    Organisiere Belege mit Tags für Projekte, Baustellen oder Veranstaltungen
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TagManagement />
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>

      {/* Cloud Storage Tab */}
      <TabsContent value="cloud-storage">
        <FeatureGate feature="cloudBackup">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <CloudStorageSettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Company Settings Tab */}
      <TabsContent value="company">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <CompanySettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Customer Management Tab */}
      <TabsContent value="customers">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <CustomerManagement />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Invoice Items Tab */}
      <TabsContent value="invoice-items">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <InvoiceItemManagement />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Invoice Templates Tab */}
      <TabsContent value="invoice-templates">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <InvoiceTemplateSettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Quote Templates Tab */}
      <TabsContent value="quote-templates">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <QuoteTemplateSettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>

      {/* Invoice Module Settings Tab */}
      <TabsContent value="invoice-settings">
        <FeatureGate feature="invoiceModule">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <InvoiceModuleSettings />
        </motion.div>
        </FeatureGate>
      </TabsContent>


    </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
