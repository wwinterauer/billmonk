import { useState, useEffect, useCallback } from 'react';
import { FileText, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  validateDescriptionSettings, 
  DEFAULT_DESCRIPTION_SETTINGS,
  type DescriptionSettings as DescSettings 
} from '@/lib/descriptionUtils';
import type { Json } from '@/integrations/supabase/types';

const SEPARATOR_OPTIONS = [
  { value: ', ', label: 'Komma ( , )' },
  { value: '; ', label: 'Semikolon ( ; )' },
  { value: ' | ', label: 'Pipe ( | )' },
  { value: ' / ', label: 'Schrägstrich ( / )' },
  { value: ' - ', label: 'Bindestrich ( - )' },
];

const TRUNCATE_OPTIONS = [
  { value: '...', label: '... (drei Punkte)' },
  { value: ' etc.', label: ' etc.' },
  { value: ' u.a.', label: ' u.a.' },
  { value: '', label: '(nichts)' },
];

const SAMPLE_ITEMS = [
  'Büromaterial',
  'Druckerpapier A4 500 Blatt',
  'Kugelschreiber blau 10 Stk',
  'Heftklammern',
  'Klebestreifen',
];

export function DescriptionSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<DescSettings>(DEFAULT_DESCRIPTION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('description_settings')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.description_settings) {
          setSettings(validateDescriptionSettings(data.description_settings));
        }
      } catch (error) {
        console.error('Error loading description settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Debounced save
  const saveSettings = useCallback(async (newSettings: DescSettings) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ description_settings: newSettings as unknown as Json })
        .eq('id', user.id);

      if (error) throw error;

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, toast]);

  const updateSetting = useCallback((key: keyof DescSettings, value: DescSettings[keyof DescSettings]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Cancel previous timeout
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }

    // Debounce save
    const timeoutId = setTimeout(() => {
      saveSettings(newSettings);
    }, 500);
    setSaveTimeoutId(timeoutId);
  }, [settings, saveTimeoutId, saveSettings]);

  // Generate preview based on current settings
  const generatePreview = useCallback((): string => {
    let preview = SAMPLE_ITEMS.join(settings.separator);
    
    if (preview.length > settings.max_length) {
      const maxContentLength = settings.max_length - settings.truncate_suffix.length;
      let truncated = preview.substring(0, maxContentLength);
      
      // Find last separator to cut at clean boundary
      const separatorTrimmed = settings.separator.trim();
      const lastSep = truncated.lastIndexOf(separatorTrimmed);
      
      if (lastSep > maxContentLength * 0.5) {
        truncated = truncated.substring(0, lastSep);
      }
      
      preview = truncated.trim() + settings.truncate_suffix;
    }
    
    return preview;
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save indicator */}
      {(isSaving || showSaved) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Speichern...</span>
            </>
          ) : showSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Gespeichert</span>
            </>
          ) : null}
        </div>
      )}

      {/* Maximum Length */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Maximale Zeichenanzahl</Label>
          <span className="text-sm text-muted-foreground font-medium">
            {settings.max_length} Zeichen
          </span>
        </div>
        <Slider
          value={[settings.max_length]}
          onValueChange={([value]) => updateSetting('max_length', value)}
          min={30}
          max={250}
          step={10}
          className="py-2"
        />
        <p className="text-xs text-muted-foreground">
          Längere Beschreibungen werden automatisch gekürzt
        </p>
      </div>

      {/* Separator */}
      <div className="space-y-2">
        <Label>Trennzeichen zwischen Positionen</Label>
        <Select
          value={settings.separator}
          onValueChange={(value) => updateSetting('separator', value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEPARATOR_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Truncate Suffix */}
      <div className="space-y-2">
        <Label>Kürzungs-Anzeige</Label>
        <Select
          value={settings.truncate_suffix}
          onValueChange={(value) => updateSetting('truncate_suffix', value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRUNCATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      <div className="p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Vorschau</Label>
        </div>
        <p className="text-sm font-mono break-words">
          {generatePreview()}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {generatePreview().length} / {settings.max_length} Zeichen
        </p>
      </div>
    </div>
  );
}
