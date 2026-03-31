import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

// Column configuration type
export interface ExportColumn {
  id: string;
  field: string;
  label: string;
  type: 'date' | 'text' | 'currency' | 'percent' | 'number' | 'empty';
  format: string | null;
  visible: boolean;
  order: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

// Export template type
export interface ExportTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  columns: ExportColumn[];
  sort_by: string | null;
  sort_direction: 'asc' | 'desc';
  group_by: string | null;
  group_subtotals: boolean;
  include_header: boolean;
  include_totals: boolean;
  date_format: string;
  number_format: string;
  template_type: 'receipts' | 'invoices';
  created_at: string;
  updated_at: string;
}

// Default columns for new templates
export const DEFAULT_COLUMNS: ExportColumn[] = [
  { id: '1', field: 'receipt_date', label: 'Datum', type: 'date', format: 'DD.MM.YYYY', visible: true, order: 0, align: 'left' },
  { id: '2', field: 'vendor', label: 'Lieferant', type: 'text', format: null, visible: true, order: 1, align: 'left' },
  { id: '3', field: 'description', label: 'Beschreibung', type: 'text', format: null, visible: true, order: 2, align: 'left' },
  { id: '4', field: 'invoice_number', label: 'Rechnungsnr.', type: 'text', format: null, visible: true, order: 3, align: 'left' },
  { id: '5', field: 'category', label: 'Kategorie', type: 'text', format: null, visible: true, order: 4, align: 'left' },
  { id: '14', field: 'tax_type', label: 'Buchungsart', type: 'text', format: null, visible: true, order: 5, align: 'left' },
  { id: '13', field: 'tags', label: 'Tags', type: 'text', format: null, visible: false, order: 6, align: 'left' },
  { id: '6', field: 'amount_gross', label: 'Brutto', type: 'currency', format: '€ #.##0,00', visible: true, order: 7, align: 'right' },
  { id: '7', field: 'amount_net', label: 'Netto', type: 'currency', format: '€ #.##0,00', visible: true, order: 8, align: 'right' },
  { id: '8', field: 'vat_rate', label: 'MwSt-Satz', type: 'percent', format: '#0%', visible: true, order: 9, align: 'right' },
  { id: '9', field: 'vat_amount', label: 'Vorsteuer', type: 'currency', format: '€ #.##0,00', visible: true, order: 10, align: 'right' },
  { id: '10', field: 'payment_method', label: 'Zahlungsart', type: 'text', format: null, visible: false, order: 11, align: 'left' },
  { id: '11', field: 'status', label: 'Status', type: 'text', format: null, visible: false, order: 12, align: 'left' },
  { id: '12', field: 'notes', label: 'Notizen', type: 'text', format: null, visible: false, order: 13, align: 'left' },
];

// Split-specific columns (only visible when feature is enabled)
export const SPLIT_COLUMNS: ExportColumn[] = [
  { id: 's1', field: 'split_position', label: 'Split-Position', type: 'number', format: '#0', visible: false, order: 20, align: 'right' },
  { id: 's2', field: 'split_description', label: 'Positions-Beschreibung', type: 'text', format: null, visible: false, order: 21, align: 'left' },
  { id: 's3', field: 'split_category', label: 'Positions-Kategorie', type: 'text', format: null, visible: false, order: 22, align: 'left' },
  { id: 's4', field: 'split_amount_gross', label: 'Positions-Brutto', type: 'currency', format: '€ #.##0,00', visible: false, order: 23, align: 'right' },
  { id: 's5', field: 'split_amount_net', label: 'Positions-Netto', type: 'currency', format: '€ #.##0,00', visible: false, order: 24, align: 'right' },
  { id: 's6', field: 'split_vat_rate', label: 'Positions-MwSt-Satz', type: 'percent', format: '#0%', visible: false, order: 25, align: 'right' },
  { id: 's7', field: 'split_vat_amount', label: 'Positions-MwSt-Betrag', type: 'currency', format: '€ #.##0,00', visible: false, order: 26, align: 'right' },
  { id: 's8', field: 'split_is_private', label: 'Privatanteil', type: 'text', format: null, visible: false, order: 27, align: 'left' },
  { id: 's9', field: 'split_tax_type', label: 'Positions-Buchungsart', type: 'text', format: null, visible: false, order: 28, align: 'left' },
];

// Default columns for invoice export templates
export const DEFAULT_INVOICE_COLUMNS: ExportColumn[] = [
  { id: 'i1', field: 'invoice_number', label: 'Rechnungsnr.', type: 'text', format: null, visible: true, order: 0, align: 'left' },
  { id: 'i2', field: 'customer_name', label: 'Kunde', type: 'text', format: null, visible: true, order: 1, align: 'left' },
  { id: 'i3', field: 'invoice_date', label: 'Rechnungsdatum', type: 'date', format: 'DD.MM.YYYY', visible: true, order: 2, align: 'left' },
  { id: 'i4', field: 'due_date', label: 'Fällig am', type: 'date', format: 'DD.MM.YYYY', visible: true, order: 3, align: 'left' },
  { id: 'i5', field: 'category', label: 'Kategorie', type: 'text', format: null, visible: true, order: 4, align: 'left' },
  { id: 'i6', field: 'subtotal', label: 'Netto', type: 'currency', format: '€ #.##0,00', visible: true, order: 5, align: 'right' },
  { id: 'i7', field: 'vat_total', label: 'USt', type: 'currency', format: '€ #.##0,00', visible: true, order: 6, align: 'right' },
  { id: 'i8', field: 'total', label: 'Brutto', type: 'currency', format: '€ #.##0,00', visible: true, order: 7, align: 'right' },
  { id: 'i9', field: 'status', label: 'Status', type: 'text', format: null, visible: true, order: 8, align: 'left' },
  { id: 'i10', field: 'paid_at', label: 'Bezahlt am', type: 'date', format: 'DD.MM.YYYY', visible: false, order: 9, align: 'left' },
  { id: 'i11', field: 'notes', label: 'Notizen', type: 'text', format: null, visible: false, order: 10, align: 'left' },
];

// Format preview function
export const formatPreview = (type: ExportColumn['type'], format: string | null): string => {
  const sampleValues = {
    date: new Date('2024-01-15'),
    currency: 1234.56,
    percent: 20,
    number: 1234,
    text: 'Beispieltext'
  };

  const value = sampleValues[type];

  if (type === 'date' && format) {
    const d = value as Date;
    return format
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('YYYY', String(d.getFullYear()))
      .replace('YY', String(d.getFullYear()).slice(-2));
  }

  if (type === 'currency') {
    const num = value as number;
    const formatted = num.toLocaleString('de-AT', { minimumFractionDigits: 2 });
    if (format?.startsWith('€')) return `€ ${formatted}`;
    if (format?.endsWith('€')) return `${formatted} €`;
    return formatted;
  }

  if (type === 'percent') {
    return `${value}%`;
  }

  if (type === 'number') {
    return (value as number).toLocaleString('de-AT');
  }

  return String(value);
};

// Field type definitions with format options
export const FIELD_TYPES: Record<string, { label: string; formats: string[] | null }> = {
  date: { label: 'Datum', formats: ['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD', 'DD/MM/YYYY'] },
  text: { label: 'Text', formats: null },
  currency: { label: 'Währung', formats: ['€ #.##0,00', '#.##0,00 €', '#,##0.00'] },
  percent: { label: 'Prozent', formats: ['#0%', '#0,0%', '#0.0%'] },
  number: { label: 'Zahl', formats: ['#.##0', '#,##0', '#0'] },
  empty: { label: 'Leerspalte', formats: null },
};

// Available fields for sorting
export const SORTABLE_FIELDS = [
  { value: 'receipt_date', label: 'Datum' },
  { value: 'vendor', label: 'Lieferant' },
  { value: 'category', label: 'Kategorie' },
  { value: 'amount_gross', label: 'Brutto' },
  { value: 'amount_net', label: 'Netto' },
  { value: 'vat_rate', label: 'MwSt-Satz' },
  { value: 'status', label: 'Status' },
  { value: 'payment_method', label: 'Zahlungsart' },
  { value: 'invoice_number', label: 'Rechnungsnr.' },
];

// Available fields for grouping with icons
export const GROUPING_OPTIONS = [
  { value: 'category', label: 'Kategorie', icon: 'Tag' },
  { value: 'tags', label: 'Tags', icon: 'Tags' },
  { value: 'vendor', label: 'Lieferant', icon: 'Building' },
  { value: 'month', label: 'Monat', icon: 'Calendar' },
  { value: 'quarter', label: 'Quartal', icon: 'CalendarDays' },
  { value: 'year', label: 'Jahr', icon: 'CalendarRange' },
  { value: 'vat_rate', label: 'MwSt-Satz', icon: 'Percent' },
  { value: 'payment_method', label: 'Zahlungsart', icon: 'CreditCard' },
];

// Group preview helper
export const getGroupPreview = (groupBy: string | null): string[] => {
  switch (groupBy) {
    case 'category':
      return ['Büromaterial', 'Software & Lizenzen', 'Reisekosten', '...'];
    case 'tags':
      return ['Baustelle Müller', 'Q1-2026', 'Projekt Alpha', '...'];
    case 'vendor':
      return ['Amazon', 'MediaMarkt', 'IKEA', '...'];
    case 'month':
      return ['Januar 2024', 'Februar 2024', 'März 2024', '...'];
    case 'quarter':
      return ['Q1 2024', 'Q2 2024', 'Q3 2024', '...'];
    case 'year':
      return ['2023', '2024', '2025'];
    case 'vat_rate':
      return ['20%', '13%', '10%', '0%'];
    case 'payment_method':
      return ['Überweisung', 'Kreditkarte', 'Bar', '...'];
    default:
      return [];
  }
};

// Sort info helper
export const getSortInfo = (sortBy: string | null, sortDirection: 'asc' | 'desc'): string => {
  const fieldLabel = SORTABLE_FIELDS.find(f => f.value === sortBy)?.label || sortBy;
  const arrow = sortDirection === 'asc' ? '↑' : '↓';
  
  let detail = '';
  if (sortBy === 'receipt_date') {
    detail = sortDirection === 'desc' ? ' (neueste zuerst)' : ' (älteste zuerst)';
  } else if (sortBy === 'amount_gross' || sortBy === 'amount_net') {
    detail = sortDirection === 'desc' ? ' (höchste zuerst)' : ' (niedrigste zuerst)';
  }
  
  return `${arrow} Sortiert nach ${fieldLabel}${detail}`;
};

// Keep AVAILABLE_FIELDS for backwards compatibility
export const AVAILABLE_FIELDS = SORTABLE_FIELDS;

export function useExportTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('export_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      // Parse columns from JSON
      const parsed = (data || []).map(t => ({
        ...t,
        columns: (t.columns as unknown as ExportColumn[]) || DEFAULT_COLUMNS,
        sort_direction: (t.sort_direction as 'asc' | 'desc') || 'asc',
        template_type: ((t as any).template_type as 'receipts' | 'invoices') || 'receipts',
      })) as ExportTemplate[];

      setTemplates(parsed);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden',
        description: 'Export-Vorlagen konnten nicht geladen werden.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Create a new template
  const createTemplate = async (
    template: Omit<ExportTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<ExportTemplate | null> => {
    if (!user) return null;

    try {
      // If setting as default, unset other defaults first
      if (template.is_default) {
        await supabase
          .from('export_templates')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('export_templates')
        .insert({
          user_id: user.id,
          name: template.name,
          description: template.description,
          is_default: template.is_default,
          columns: template.columns as unknown as Json,
          sort_by: template.sort_by,
          sort_direction: template.sort_direction,
          group_by: template.group_by,
          group_subtotals: template.group_subtotals,
          include_header: template.include_header,
          include_totals: template.include_totals,
          date_format: template.date_format,
          number_format: template.number_format,
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate = {
        ...data,
        columns: data.columns as unknown as ExportColumn[],
        sort_direction: data.sort_direction as 'asc' | 'desc',
      } as ExportTemplate;

      setTemplates(prev => [...prev, newTemplate]);
      toast({ title: 'Vorlage erstellt' });
      return newTemplate;
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Vorlage konnte nicht erstellt werden.',
      });
      return null;
    }
  };

  // Update an existing template
  const updateTemplate = async (
    id: string,
    updates: Partial<Omit<ExportTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // If setting as default, unset other defaults first
      if (updates.is_default) {
        await supabase
          .from('export_templates')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const updateData: Record<string, unknown> = { ...updates };
      if (updates.columns) {
        updateData.columns = updates.columns as unknown as Json;
      }

      const { error } = await supabase
        .from('export_templates')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTemplates(prev =>
        prev.map(t => (t.id === id ? { ...t, ...updates } : t))
      );
      toast({ title: 'Vorlage gespeichert' });
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Vorlage konnte nicht gespeichert werden.',
      });
      return false;
    }
  };

  // Delete a template
  const deleteTemplate = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('export_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: 'Vorlage gelöscht' });
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Vorlage konnte nicht gelöscht werden.',
      });
      return false;
    }
  };

  // Get the default template
  const getDefaultTemplate = (): ExportTemplate | null => {
    return templates.find(t => t.is_default) || null;
  };

  // Create an empty template structure
  const createEmptyTemplate = (type: 'receipts' | 'invoices' = 'receipts'): Omit<ExportTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'> => ({
    name: type === 'invoices' ? 'Neue Rechnungsvorlage' : 'Neue Vorlage',
    description: null,
    is_default: false,
    columns: type === 'invoices' ? [...DEFAULT_INVOICE_COLUMNS] : [...DEFAULT_COLUMNS],
    sort_by: type === 'invoices' ? 'invoice_date' : 'receipt_date',
    sort_direction: 'desc',
    group_by: null,
    group_subtotals: true,
    include_header: true,
    include_totals: true,
    date_format: 'DD.MM.YYYY',
    number_format: 'de-AT',
    template_type: type,
  });

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getDefaultTemplate,
    createEmptyTemplate,
  };
}
