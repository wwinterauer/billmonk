import { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2
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
import type { Json } from '@/integrations/supabase/types';

interface NamingSettings {
  template: string;
  replaceUmlauts: boolean;
  replaceSpaces: boolean;
  removeSpecialChars: boolean;
  lowercase: boolean;
  dateFormat: string;
}

const DEFAULT_SETTINGS: NamingSettings = {
  template: '{datum}_{lieferant}_{betrag}',
  replaceUmlauts: true,
  replaceSpaces: true,
  removeSpecialChars: true,
  lowercase: false,
  dateFormat: 'YYYY-MM-DD',
};

const PLACEHOLDERS = [
  { key: '{datum}', label: 'Datum', description: 'Belegdatum (Format nach Auswahl)', icon: Calendar },
  { key: '{datum_de}', label: 'Datum DE', description: 'Belegdatum (DD.MM.YYYY)', icon: Calendar },
  { key: '{lieferant}', label: 'Lieferant', description: 'Name des Lieferanten', icon: Tag },
  { key: '{betrag}', label: 'Betrag', description: 'Bruttobetrag', icon: DollarSign },
  { key: '{kategorie}', label: 'Kategorie', description: 'Kategorie des Belegs', icon: FolderOpen },
  { key: '{nummer}', label: 'Nummer', description: 'Fortlaufende Nummer', icon: Hash },
  { key: '{original}', label: 'Original', description: 'Original-Dateiname (ohne Endung)', icon: File },
];

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-01-15' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '15.01.2024' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '15-01-2024' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD', example: '20240115' },
];

// Example data for preview
const EXAMPLE_DATA = {
  datum: '2024-01-15',
  datum_de: '15.01.2024',
  lieferant: 'Müller GmbH',
  betrag: '125.50',
  kategorie: 'Büromaterial',
  nummer: '001',
  original: 'Rechnung_2024',
};

const Settings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  
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
            replaceSpaces: savedSettings.replaceSpaces !== undefined ? Boolean(savedSettings.replaceSpaces) : DEFAULT_SETTINGS.replaceSpaces,
            removeSpecialChars: savedSettings.removeSpecialChars !== undefined ? Boolean(savedSettings.removeSpecialChars) : DEFAULT_SETTINGS.removeSpecialChars,
            lowercase: savedSettings.lowercase !== undefined ? Boolean(savedSettings.lowercase) : DEFAULT_SETTINGS.lowercase,
            dateFormat: (savedSettings.dateFormat as string) || DEFAULT_SETTINGS.dateFormat,
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

    if (settings.replaceSpaces) {
      result = result.replace(/\s+/g, '_');
    }

    if (settings.removeSpecialChars) {
      // Keep alphanumeric, underscores, hyphens, and dots
      result = result.replace(/[^a-zA-Z0-9_\-.]/g, '');
    }

    if (settings.lowercase) {
      result = result.toLowerCase();
    }

    return result;
  };

  // Format date according to selected format
  const formatDate = (dateStr: string, format: string): string => {
    const [year, month, day] = dateStr.split('-');
    switch (format) {
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'YYYYMMDD':
        return `${year}${month}${day}`;
      case 'YYYY-MM-DD':
      default:
        return dateStr;
    }
  };

  // Generate preview filename
  const previewFilename = useMemo(() => {
    let result = settings.template;

    // Replace placeholders with example data
    const formattedDate = formatDate(EXAMPLE_DATA.datum, settings.dateFormat);
    result = result.replace(/{datum}/g, formattedDate);
    result = result.replace(/{datum_de}/g, EXAMPLE_DATA.datum_de);
    result = result.replace(/{lieferant}/g, EXAMPLE_DATA.lieferant);
    result = result.replace(/{betrag}/g, EXAMPLE_DATA.betrag);
    result = result.replace(/{kategorie}/g, EXAMPLE_DATA.kategorie);
    result = result.replace(/{nummer}/g, EXAMPLE_DATA.nummer);
    result = result.replace(/{original}/g, EXAMPLE_DATA.original);

    // Apply transformations
    result = applyTransformations(result);

    return result + '.pdf';
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

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground">Verwalte deine Kontoeinstellungen und Präferenzen</p>
        </div>

        {/* File Naming Section */}
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
                
                {/* Placeholder Chips */}
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDERS.map((placeholder) => (
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

              {/* Date Format */}
              <div className="space-y-3">
                <Label>Datumsformat</Label>
                <Select
                  value={settings.dateFormat}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, dateFormat: value }))}
                >
                  <SelectTrigger className="w-[250px]">
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

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="replaceSpaces"
                      checked={settings.replaceSpaces}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, replaceSpaces: checked as boolean }))
                      }
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor="replaceSpaces"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Leerzeichen ersetzen
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Leerzeichen durch Unterstrich ersetzen
                      </p>
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

              {/* Live Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Live-Vorschau</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Beispiel-Beleg:</p>
                      <p className="text-muted-foreground">
                        Lieferant: {EXAMPLE_DATA.lieferant}<br />
                        Datum: {EXAMPLE_DATA.datum_de}<br />
                        Betrag: €{EXAMPLE_DATA.betrag}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-sm break-all">{previewFilename}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Basierend auf Beispiel-Beleg: {EXAMPLE_DATA.lieferant}, {EXAMPLE_DATA.datum_de}, €{EXAMPLE_DATA.betrag}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="gradient-primary hover:opacity-90"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
