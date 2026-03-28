import { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  FileSpreadsheet,
  File,
  Archive,
  Download,
  Loader2,
  Table,
  Settings,
  CheckCircle2,
  X,
  Folder,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Receipt } from '@/hooks/useReceipts';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';
import { 
  useExportTemplates, 
  DEFAULT_COLUMNS,
} from '@/hooks/useExportTemplates';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'zip';

interface ExportFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipts: Receipt[];
  format: ExportFormat;
  dateRange?: { from?: Date; to?: Date };
}

// Naming settings for ZIP export
interface NamingSettings {
  template: string;
  replaceUmlauts: boolean;
  replaceSpaces: 'none' | 'underscore' | 'hyphen';
  removeSpecialChars: boolean;
  lowercase: boolean;
  dateFormat: string;
  emptyFieldHandling: 'keep' | 'replace' | 'remove';
}

const DEFAULT_NAMING_SETTINGS: NamingSettings = {
  template: '{datum}_{lieferant}_{betrag}',
  replaceUmlauts: true,
  replaceSpaces: 'underscore',
  removeSpecialChars: true,
  lowercase: false,
  dateFormat: 'YYYYMMDD',
  emptyFieldHandling: 'remove',
};

export function ExportFormatDialog({ 
  open, 
  onOpenChange, 
  receipts, 
  format: exportFormat,
  dateRange 
}: ExportFormatDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const abortRef = useRef(false);
  const { templates, loading: templatesLoading } = useExportTemplates();
  const { splitBookingEnabled } = usePlan();

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');

  // Export options
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeTotals, setIncludeTotals] = useState(true);
  const [excludeNoReceipt, setExcludeNoReceipt] = useState(true);
  const [expandSplitBookings, setExpandSplitBookings] = useState(false);

  // ZIP options
  const [zipStructure, setZipStructure] = useState<'flat' | 'month' | 'category' | 'vendor'>('month');
  const [renameFiles, setRenameFiles] = useState(true);
  const [namingSettings, setNamingSettings] = useState<NamingSettings>(DEFAULT_NAMING_SETTINGS);

  // Folder selection
  const [exportFolder, setExportFolder] = useState<'downloads' | 'custom'>('downloads');
  const [customFolderName, setCustomFolderName] = useState<string>('');
  const [includeSubfolder, setIncludeSubfolder] = useState<boolean>(true);
  const [selectedFolderHandle, setSelectedFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [exportedCount, setExportedCount] = useState(0);

  // Check for File System Access API support
  const supportsDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Load export preferences from localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem('exportPreferences');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setExportFolder(prefs.exportFolder || 'downloads');
        setCustomFolderName(prefs.customFolderName || '');
        setIncludeSubfolder(prefs.includeSubfolder ?? true);
        setIncludeHeader(prefs.includeHeader ?? true);
        setIncludeTotals(prefs.includeTotals ?? true);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save export preferences to localStorage
  useEffect(() => {
    localStorage.setItem('exportPreferences', JSON.stringify({
      exportFolder,
      customFolderName,
      includeSubfolder,
      includeHeader,
      includeTotals
    }));
  }, [exportFolder, customFolderName, includeSubfolder, includeHeader, includeTotals]);

  // Load naming settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('naming_settings')
          .eq('id', user.id)
          .single();

        if (data?.naming_settings && typeof data.naming_settings === 'object') {
          const saved = data.naming_settings as Record<string, unknown>;
          setNamingSettings({
            template: (saved.template as string) || DEFAULT_NAMING_SETTINGS.template,
            replaceUmlauts: saved.replaceUmlauts !== undefined ? Boolean(saved.replaceUmlauts) : DEFAULT_NAMING_SETTINGS.replaceUmlauts,
            replaceSpaces: (['underscore', 'hyphen', 'none'].includes(saved.replaceSpaces as string) 
              ? saved.replaceSpaces as 'underscore' | 'hyphen' | 'none' 
              : DEFAULT_NAMING_SETTINGS.replaceSpaces),
            removeSpecialChars: saved.removeSpecialChars !== undefined ? Boolean(saved.removeSpecialChars) : DEFAULT_NAMING_SETTINGS.removeSpecialChars,
            lowercase: saved.lowercase !== undefined ? Boolean(saved.lowercase) : DEFAULT_NAMING_SETTINGS.lowercase,
            dateFormat: (saved.dateFormat as string) || DEFAULT_NAMING_SETTINGS.dateFormat,
            emptyFieldHandling: (saved.emptyFieldHandling as NamingSettings['emptyFieldHandling']) || DEFAULT_NAMING_SETTINGS.emptyFieldHandling,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [user, open]);

  // Select default template when templates load
  useEffect(() => {
    if (templates.length > 0 && selectedTemplateId === 'default') {
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, selectedTemplateId]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIsExporting(false);
      setExportComplete(false);
      setProgress(0);
      setCurrentItem(0);
      setCurrentFileName('');
      abortRef.current = false;
    }
  }, [open]);

  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId === 'default') return null;
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const visibleColumns = useMemo(() => {
    if (!selectedTemplate) {
      return DEFAULT_COLUMNS.filter(c => c.visible).sort((a, b) => a.order - b.order);
    }
    return (selectedTemplate.columns || [])
      .filter(c => c.visible)
      .sort((a, b) => a.order - b.order);
  }, [selectedTemplate]);

  // Folder selection handler
  const selectFolder = async (): Promise<boolean> => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (options?: { mode?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });
      
      setSelectedFolderHandle(handle);
      setSelectedFolderName(handle.name);
      setExportFolder('custom');
      toast({ title: `Ordner "${handle.name}" ausgewählt` });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Fehler bei Ordner-Auswahl:', error);
        
        // Check if it's an iframe security error
        const isSecurityError = (error as Error).name === 'SecurityError';
        toast({
          variant: 'destructive',
          title: 'Ordner konnte nicht ausgewählt werden',
          description: isSecurityError 
            ? 'Ordnerauswahl funktioniert nur in einem eigenen Tab. Öffne die App in einem neuen Tab.'
            : undefined,
        });
      }
      return false;
    }
  };

  // Get or create subfolder
  const getOrCreateSubfolder = async (
    parentHandle: FileSystemDirectoryHandle,
    folderPath: string
  ): Promise<FileSystemDirectoryHandle> => {
    const parts = folderPath.split('/').filter(p => p);
    let currentHandle = parentHandle;
    
    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    
    return currentHandle;
  };

  // Save export file (with folder selection support)
  const saveExportFile = async (content: Blob, filename: string, subfolder: string) => {
    // Option 1: File System Access API (modern browser + folder selected)
    if (exportFolder === 'custom' && selectedFolderHandle) {
      try {
        let targetFolder = selectedFolderHandle;
        
        // Create subfolder if desired
        if (includeSubfolder && subfolder) {
          targetFolder = await getOrCreateSubfolder(selectedFolderHandle, subfolder);
        }
        
        // Create file
        const fileHandle = await targetFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        toast({ 
          title: 'Gespeichert',
          description: `${selectedFolderName}/${subfolder ? subfolder + '/' : ''}${filename}`
        });
        return;
      } catch (error) {
        console.error('Fehler beim Speichern:', error);
        // Fallback to normal download
      }
    }
    
    // Option 2: Normal browser download
    let downloadFilename = filename;
    
    // With custom folder name: Include in filename (fallback)
    if (exportFolder === 'custom' && customFolderName) {
      const folderPrefix = customFolderName.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      downloadFilename = `${folderPrefix}_${filename}`;
    }
    
    // With subfolder: Append period to filename
    if (includeSubfolder && subfolder) {
      const ext = filename.split('.').pop();
      const name = filename.replace(`.${ext}`, '');
      downloadFilename = `${name}_${subfolder}.${ext}`;
    }
    
    saveAs(content, downloadFilename);
  };

  const getGroupLabel = (groupBy: string | null): string => {
    switch (groupBy) {
      case 'category': return 'Kategorie';
      case 'vendor': return 'Lieferant';
      case 'month': return 'Monat';
      case 'quarter': return 'Quartal';
      case 'year': return 'Jahr';
      case 'vat_rate': return 'MwSt-Satz';
      case 'payment_method': return 'Zahlungsart';
      default: return groupBy || '';
    }
  };

  const getFormatIcon = () => {
    switch (exportFormat) {
      case 'csv': return <FileText className="w-5 h-5" />;
      case 'excel': return <FileSpreadsheet className="w-5 h-5" />;
      case 'pdf': return <File className="w-5 h-5" />;
      case 'zip': return <Archive className="w-5 h-5" />;
    }
  };

  const getFormatTitle = () => {
    switch (exportFormat) {
      case 'csv': return 'Als CSV exportieren';
      case 'excel': return 'Als Excel exportieren';
      case 'pdf': return 'Als PDF exportieren';
      case 'zip': return 'Belege als ZIP exportieren';
    }
  };

  const getFormatInfo = () => {
    switch (exportFormat) {
      case 'csv': return 'Format: CSV (Semikolon-getrennt, UTF-8)';
      case 'excel': return 'Format: XLSX (Excel 2007+)';
      case 'pdf': return 'Format: PDF (DIN A4 Querformat)';
      case 'zip': return 'Format: ZIP mit Original-Dateien';
    }
  };

  // Helper functions for file naming
  const formatDate = (dateStr: string | null, formatStr: string): string => {
    if (!dateStr) return 'kein-datum';
    const [year, month, day] = dateStr.split('-');
    const year2 = year.slice(2);
    switch (formatStr) {
      case 'DD.MM.YYYY': return `${day}.${month}.${year}`;
      case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
      case 'DD.MM.YY': return `${day}.${month}.${year2}`;
      case 'YYYYMMDD': return `${year}${month}${day}`;
      case 'YYMMDD': return `${year2}${month}${day}`;
      case 'YYYY-MM-DD':
      default: return dateStr;
    }
  };

  const getDateParts = (dateStr: string | null) => {
    if (!dateStr) return { year: 'kein', year2: 'kein', month: 'kein', day: 'kein' };
    const [year, month, day] = dateStr.split('-');
    return { year, year2: year.slice(2), month, day };
  };

  const handleEmptyField = (value: string | null | undefined): string => {
    if (value) return value;
    switch (namingSettings.emptyFieldHandling) {
      case 'replace': return 'k.A.';
      case 'remove': return '';
      case 'keep':
      default: return '';
    }
  };

  const applyTransformations = (text: string): string => {
    let result = text;

    if (namingSettings.replaceUmlauts) {
      result = result
        .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
        .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
        .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss');
    }

    if (namingSettings.replaceSpaces === 'underscore') {
      result = result.replace(/\s+/g, '_');
    } else if (namingSettings.replaceSpaces === 'hyphen') {
      result = result.replace(/\s+/g, '-');
    }

    if (namingSettings.removeSpecialChars) {
      result = result.replace(/[^a-zA-Z0-9_\-.]/g, '');
    }

    if (namingSettings.lowercase) {
      result = result.toLowerCase();
    }

    result = result.replace(/[-_]+/g, (match) => match[0]).replace(/^[-_]|[-_]$/g, '');

    return result;
  };

  const getFileExtension = (fileName: string | null): string => {
    if (!fileName) return 'pdf';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'pdf';
  };

  const getFileNameWithoutExtension = (fileName: string | null): string => {
    if (!fileName) return 'unbekannt';
    const parts = fileName.split('.');
    parts.pop();
    return parts.join('.') || fileName;
  };

  const generateFileName = (receipt: Receipt, index: number): string => {
    let name = namingSettings.template;

    const formattedDate = formatDate(receipt.receipt_date, namingSettings.dateFormat);
    const dateParts = getDateParts(receipt.receipt_date);
    
    name = name.replace(/{datum}/g, formattedDate);
    name = name.replace(/{jahr}/g, dateParts.year);
    name = name.replace(/{jahr2}/g, dateParts.year2);
    name = name.replace(/{monat}/g, dateParts.month);
    name = name.replace(/{tag}/g, dateParts.day);

    name = name.replace(/{lieferant}/g, handleEmptyField(receipt.vendor));
    name = name.replace(/{betrag}/g, receipt.amount_gross?.toFixed(2) || '0');
    name = name.replace(/{betrag_int}/g, receipt.amount_gross ? Math.round(receipt.amount_gross * 100).toString() : '0');
    name = name.replace(/{kategorie}/g, handleEmptyField(receipt.category));
    name = name.replace(/{rechnungsnummer}/g, handleEmptyField(receipt.invoice_number));
    name = name.replace(/{zahlungsart}/g, handleEmptyField(receipt.payment_method));

    name = name.replace(/{nummer}/g, String(index + 1).padStart(3, '0'));
    name = name.replace(/{original}/g, getFileNameWithoutExtension(receipt.file_name));

    name = applyTransformations(name);

    const extension = getFileExtension(receipt.file_name);
    return name + '.' + extension;
  };

  // Data preparation helpers
  const getReceiptValue = (receipt: Receipt, field: string): unknown => {
    switch (field) {
      case 'receipt_date': return receipt.receipt_date;
      case 'vendor': return receipt.vendor;
      case 'description': return receipt.description;
      case 'invoice_number': return receipt.invoice_number;
      case 'category': return receipt.category;
      case 'amount_gross': return receipt.amount_gross;
      case 'amount_net': return receipt.amount_net;
      case 'vat_rate': return receipt.vat_rate;
      case 'vat_amount': return receipt.vat_amount;
      case 'payment_method': return receipt.payment_method;
      case 'status': return receipt.status;
      case 'notes': return receipt.notes;
      // Split-specific fields (populated when expandSplitBookings is active)
      case 'split_position': return (receipt as any)._split_position ?? '';
      case 'split_description': return (receipt as any)._split_description ?? '';
      case 'split_category': return (receipt as any)._split_category ?? '';
      case 'split_amount_gross': return (receipt as any)._split_amount_gross ?? '';
      case 'split_amount_net': return (receipt as any)._split_amount_net ?? '';
      case 'split_vat_rate': return (receipt as any)._split_vat_rate ?? '';
      case 'split_vat_amount': return (receipt as any)._split_vat_amount ?? '';
      case 'split_is_private': return (receipt as any)._split_is_private ? 'Ja' : '';
      default: return (receipt as unknown as Record<string, unknown>)[field];
    }
  };

  const formatValue = (value: unknown, type: string, formatStr: string | null, locale = 'de-AT'): string => {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'date':
        if (!value) return '';
        const dateStr = String(value);
        if (formatStr === 'DD.MM.YYYY' && dateStr.includes('-')) {
          const [y, m, d] = dateStr.split('-');
          return `${d}.${m}.${y}`;
        }
        if (formatStr === 'YYYY-MM-DD') return dateStr;
        return dateStr;

      case 'currency':
        return new Intl.NumberFormat(locale, { 
          style: 'currency', 
          currency: 'EUR' 
        }).format(Number(value) || 0);

      case 'percent':
        return `${value}%`;

      case 'number':
        return new Intl.NumberFormat(locale).format(Number(value) || 0);

      default:
        return String(value);
    }
  };

  const getGroupKey = (receipt: Receipt, groupBy: string): string => {
    switch (groupBy) {
      case 'category':
        return receipt.category || 'Ohne Kategorie';
      case 'vendor':
        return receipt.vendor || 'Unbekannt';
      case 'month':
        if (!receipt.receipt_date) return 'Ohne Datum';
        const d = new Date(receipt.receipt_date);
        return format(d, 'MMMM yyyy', { locale: de });
      case 'quarter':
        if (!receipt.receipt_date) return 'Ohne Datum';
        const qd = new Date(receipt.receipt_date);
        const quarter = Math.ceil((qd.getMonth() + 1) / 3);
        return `Q${quarter} ${qd.getFullYear()}`;
      case 'year':
        if (!receipt.receipt_date) return 'Ohne Datum';
        return receipt.receipt_date.substring(0, 4);
      case 'vat_rate':
        return `${receipt.vat_rate || 0}%`;
      case 'payment_method':
        return receipt.payment_method || 'Unbekannt';
      default:
        return 'Alle';
    }
  };

  const prepareExportData = async () => {
    const columns = visibleColumns;
    let sortedReceipts = [...receipts];

    // Filter out "Keine Rechnung" if option is enabled (not for ZIP)
    if (excludeNoReceipt && exportFormat !== 'zip') {
      sortedReceipts = sortedReceipts.filter(r => r.category !== 'Keine Rechnung');
    }

    // Expand split bookings into multiple rows
    if (expandSplitBookings && splitBookingEnabled && user) {
      const splitReceiptIds = sortedReceipts
        .filter(r => (r as any).is_split_booking)
        .map(r => r.id);

      if (splitReceiptIds.length > 0) {
        const { data: splitLines } = await supabase
          .from('receipt_split_lines')
          .select('*')
          .eq('user_id', user.id)
          .in('receipt_id', splitReceiptIds)
          .order('sort_order', { ascending: true });

        if (splitLines && splitLines.length > 0) {
          // Group by receipt_id
          const linesByReceipt = new Map<string, typeof splitLines>();
          splitLines.forEach(line => {
            const lines = linesByReceipt.get(line.receipt_id) || [];
            lines.push(line);
            linesByReceipt.set(line.receipt_id, lines);
          });

          // Expand receipts
          const expanded: Receipt[] = [];
          for (const receipt of sortedReceipts) {
            const lines = linesByReceipt.get(receipt.id);
            if ((receipt as any).is_split_booking && lines && lines.length > 0) {
              lines.forEach((line, idx) => {
                expanded.push({
                  ...receipt,
                  _split_position: idx + 1,
                  _split_description: line.description,
                  _split_category: line.category,
                  _split_amount_gross: line.amount_gross,
                  _split_amount_net: line.amount_net,
                  _split_vat_rate: line.vat_rate,
                  _split_vat_amount: line.vat_amount,
                  _split_is_private: line.is_private,
                } as any);
              });
            } else {
              expanded.push(receipt);
            }
          }
          sortedReceipts = expanded;
        }
      }
    }

    // Apply sorting from template
    if (selectedTemplate?.sort_by) {
      sortedReceipts.sort((a, b) => {
        const aVal = getReceiptValue(a, selectedTemplate.sort_by!) || '';
        const bVal = getReceiptValue(b, selectedTemplate.sort_by!) || '';
        const comparison = String(aVal).localeCompare(String(bVal));
        return selectedTemplate.sort_direction === 'desc' ? -comparison : comparison;
      });
    }

    // Apply grouping
    let groupedData: Map<string, Receipt[]> | null = null;
    if (selectedTemplate?.group_by) {
      groupedData = new Map();
      for (const receipt of sortedReceipts) {
        const groupKey = getGroupKey(receipt, selectedTemplate.group_by);
        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, []);
        }
        groupedData.get(groupKey)!.push(receipt);
      }
    }

    return { columns, receipts: sortedReceipts, groupedData };
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  // CSV Export - returns Blob
  const generateCSV = async (): Promise<Blob> => {
    const { columns, receipts: data, groupedData } = await prepareExportData();
    const lines: string[] = [];
    const template = selectedTemplate;

    if (includeHeader) {
      lines.push(columns.map(c => `"${c.label}"`).join(';'));
    }

    const formatRow = (receipt: Receipt) => {
      return columns.map(col => {
        const value = getReceiptValue(receipt, col.field);
        const formatted = formatValue(value, col.type, col.format, template?.number_format || 'de-AT');
        return `"${formatted}"`;
      }).join(';');
    };

    if (groupedData) {
      for (const [groupName, items] of groupedData) {
        lines.push(`"${groupName}"` + ';'.repeat(columns.length - 1));
        items.forEach(receipt => lines.push(formatRow(receipt)));

        if (template?.group_subtotals) {
          const subtotalRow = columns.map(col => {
            if (col.type === 'currency') {
              const sum = items.reduce((s, r) => s + (Number(getReceiptValue(r, col.field)) || 0), 0);
              return `"${formatValue(sum, 'currency', col.format)}"`;
            }
            return col === columns[0] ? '"Zwischensumme"' : '""';
          }).join(';');
          lines.push(subtotalRow);
        }
        lines.push('');
      }
    } else {
      data.forEach(receipt => lines.push(formatRow(receipt)));
    }

    if (includeTotals) {
      const totalRow = columns.map(col => {
        if (col.type === 'currency') {
          const sum = data.reduce((s, r) => s + (Number(getReceiptValue(r, col.field)) || 0), 0);
          return `"${formatValue(sum, 'currency', col.format)}"`;
        }
        return col === columns[0] ? '"GESAMT"' : '""';
      }).join(';');
      lines.push(totalRow);
    }

    const csv = lines.join('\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  };

  // Excel Export - returns Blob
  const generateExcel = async (): Promise<Blob> => {
    const { columns, receipts: data, groupedData } = await prepareExportData();
    const template = selectedTemplate;
    const rows: unknown[][] = [];

    if (includeHeader) {
      rows.push(columns.map(c => c.label));
    }

    const addReceiptRow = (receipt: Receipt) => {
      return columns.map(col => {
        const value = getReceiptValue(receipt, col.field);
        if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') {
          return Number(value) || 0;
        }
        if (col.type === 'date' && value) {
          const [y, m, d] = String(value).split('-');
          return `${d}.${m}.${y}`;
        }
        return value || '';
      });
    };

    if (groupedData) {
      for (const [groupName, items] of groupedData) {
        const groupRow = Array.from({ length: columns.length }, () => '');
        groupRow[0] = groupName;
        rows.push(groupRow);

        items.forEach(receipt => rows.push(addReceiptRow(receipt)));

        if (template?.group_subtotals) {
          const subtotalRow = columns.map((col, i) => {
            if (col.type === 'currency') {
              return items.reduce((s, r) => s + (Number(getReceiptValue(r, col.field)) || 0), 0);
            }
            return i === 0 ? 'Zwischensumme' : '';
          });
          rows.push(subtotalRow);
        }
        rows.push([]);
      }
    } else {
      data.forEach(receipt => rows.push(addReceiptRow(receipt)));
    }

    if (includeTotals) {
      const totalRow = columns.map((col, i) => {
        if (col.type === 'currency') {
          return data.reduce((s, r) => s + (Number(getReceiptValue(r, col.field)) || 0), 0);
        }
        return i === 0 ? 'GESAMT' : '';
      });
      rows.push(totalRow);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = columns.map(col => ({ wch: col.width ? Math.round(col.width / 7) : 15 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ausgaben');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  };

  // PDF Export - returns Blob
  const generatePDF = async (): Promise<Blob> => {
    const { columns, receipts: data, groupedData } = await prepareExportData();
    const template = selectedTemplate;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Title
    doc.setFontSize(16);
    doc.text('Ausgabenübersicht', 14, 15);
    
    // Date range
    if (dateRange?.from && dateRange?.to) {
      doc.setFontSize(10);
      doc.text(
        `Zeitraum: ${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`,
        14, 22
      );
    }

    const headers = columns.map(c => c.label);
    let startY = 28;

    const formatRowForPDF = (receipt: Receipt) => {
      return columns.map(col => {
        const value = getReceiptValue(receipt, col.field);
        return formatValue(value, col.type, col.format, template?.number_format || 'de-AT');
      });
    };

    if (groupedData) {
      for (const [groupName, items] of groupedData) {
        doc.setFontSize(12);
        doc.setTextColor(80, 80, 80);
        doc.text(groupName, 14, startY);
        startY += 5;

        const body = items.map(formatRowForPDF);

        if (template?.group_subtotals) {
          const subtotalRow = columns.map(col => {
            if (col.type === 'currency') {
              const sum = items.reduce((s, r) => s + (Number(getReceiptValue(r, col.field)) || 0), 0);
              return formatValue(sum, 'currency', col.format);
            }
            return col === columns[0] ? 'Zwischensumme' : '';
          });
          body.push(subtotalRow);
        }

        autoTable(doc, {
          head: includeHeader ? [headers] : [],
          body,
          startY,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [124, 58, 237] },
        });

        startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }
    } else {
      const body = data.map(formatRowForPDF);

      autoTable(doc, {
        head: includeHeader ? [headers] : [],
        body,
        startY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [124, 58, 237] },
      });

      startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }

    // Totals
    if (includeTotals) {
      const totalGross = data.reduce((s, r) => s + (r.amount_gross || 0), 0);
      const totalNet = data.reduce((s, r) => s + (r.amount_net || 0), 0);
      const totalVat = data.reduce((s, r) => s + (r.vat_amount || 0), 0);

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Gesamt Brutto: ${formatValue(totalGross, 'currency', null)}`, 14, startY + 5);
      doc.text(`Gesamt Netto: ${formatValue(totalNet, 'currency', null)}`, 80, startY + 5);
      doc.text(`Gesamt MwSt: ${formatValue(totalVat, 'currency', null)}`, 146, startY + 5);
    }

    return doc.output('blob');
  };

  // Generate ZIP Blob
  const generateZIPBlob = async (): Promise<Blob> => {
    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    for (let i = 0; i < receipts.length; i++) {
      if (abortRef.current) break;

      const receipt = receipts[i];
      setCurrentItem(i + 1);
      setProgress(Math.round(((i + 1) / receipts.length) * 100));

      if (!receipt.file_url) continue;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.file_url, 60);

      if (urlError || !urlData?.signedUrl) continue;

      try {
        const response = await fetch(urlData.signedUrl);
        if (!response.ok) continue;
        const blob = await response.blob();

        let newName = renameFiles ? generateFileName(receipt, i) : receipt.file_name || `beleg_${i + 1}.pdf`;
        setCurrentFileName(newName);

        const baseName = newName.replace(/\.[^/.]+$/, '');
        const ext = getFileExtension(receipt.file_name);
        
        if (usedNames.has(newName)) {
          const count = usedNames.get(newName)! + 1;
          usedNames.set(newName, count);
          newName = `${baseName}_${count}.${ext}`;
        } else {
          usedNames.set(newName, 1);
        }

        let folderPath = '';
        switch (zipStructure) {
          case 'month':
            if (receipt.receipt_date) {
              folderPath = receipt.receipt_date.substring(0, 7) + '/';
            }
            break;
          case 'category':
            if (receipt.category) {
              folderPath = applyTransformations(receipt.category) + '/';
            }
            break;
          case 'vendor':
            if (receipt.vendor) {
              folderPath = applyTransformations(receipt.vendor) + '/';
            }
            break;
        }

        zip.file(folderPath + newName, blob);
      } catch (fetchError) {
        console.error('Error fetching file:', fetchError);
      }
    }

    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  };

  // ZIP Export with folder support
  const exportToZIP = async () => {
    if (receipts.length === 0) return;

    setIsExporting(true);
    setExportComplete(false);
    setProgress(0);
    setCurrentItem(0);
    setCurrentFileName('');
    abortRef.current = false;

    const zip = new JSZip();
    const usedNames = new Map<string, number>();
    let successCount = 0;

    try {
      for (let i = 0; i < receipts.length; i++) {
        if (abortRef.current) {
          toast({ title: 'Export abgebrochen' });
          break;
        }

        const receipt = receipts[i];
        setCurrentItem(i + 1);
        setProgress(Math.round(((i + 1) / receipts.length) * 100));

        if (!receipt.file_url) continue;

        const { data: urlData, error: urlError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 60);

        if (urlError || !urlData?.signedUrl) continue;

        try {
          const response = await fetch(urlData.signedUrl);
          if (!response.ok) continue;
          const blob = await response.blob();

          let newName = renameFiles ? generateFileName(receipt, i) : receipt.file_name || `beleg_${i + 1}.pdf`;
          setCurrentFileName(newName);

          const baseName = newName.replace(/\.[^/.]+$/, '');
          const ext = getFileExtension(receipt.file_name);
          
          if (usedNames.has(newName)) {
            const count = usedNames.get(newName)! + 1;
            usedNames.set(newName, count);
            newName = `${baseName}_${count}.${ext}`;
          } else {
            usedNames.set(newName, 1);
          }

          let folderPath = '';
          switch (zipStructure) {
            case 'month':
              if (receipt.receipt_date) {
                folderPath = receipt.receipt_date.substring(0, 7) + '/';
              }
              break;
            case 'category':
              if (receipt.category) {
                folderPath = applyTransformations(receipt.category) + '/';
              }
              break;
            case 'vendor':
              if (receipt.vendor) {
                folderPath = applyTransformations(receipt.vendor) + '/';
              }
              break;
          }

          zip.file(folderPath + newName, blob);
          successCount++;
        } catch (fetchError) {
          console.error('Error fetching file:', fetchError);
        }
      }

      if (!abortRef.current) {
        const content = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        const exportDate = format(new Date(), 'yyyy-MM-dd');
        const subfolder = includeSubfolder && dateRange?.from 
          ? format(dateRange.from, 'yyyy-MM')
          : '';
        
        await saveExportFile(content, `belege_export_${exportDate}.zip`, subfolder);
        setExportedCount(successCount);
        setExportComplete(true);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Export',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      setIsExporting(false);
    }
  };

  const executeExport = async () => {
    setIsExporting(true);

    try {
      const exportDate = format(new Date(), 'yyyy-MM-dd');
      const subfolder = includeSubfolder && dateRange?.from 
        ? format(dateRange.from, 'yyyy-MM')
        : '';

      switch (exportFormat) {
        case 'csv': {
          const blob = await generateCSV();
          await saveExportFile(blob, `ausgaben_${exportDate}.csv`, subfolder);
          break;
        }
        case 'excel': {
          const blob = await generateExcel();
          await saveExportFile(blob, `ausgaben_${exportDate}.xlsx`, subfolder);
          break;
        }
        case 'pdf': {
          const blob = await generatePDF();
          await saveExportFile(blob, `ausgaben_${exportDate}.pdf`, subfolder);
          break;
        }
        case 'zip':
          await exportToZIP();
          return; // ZIP handles its own completion state
      }

      toast({ title: 'Export erfolgreich' });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      if (exportFormat !== 'zip') {
        setIsExporting(false);
      }
    }
  };

  const handleClose = () => {
    setIsExporting(false);
    setExportComplete(false);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isExporting && !exportComplete && onOpenChange(v)}>
      <DialogContent className={exportFormat === 'zip' ? 'max-w-2xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFormatIcon()}
            {exportComplete ? 'Export abgeschlossen' : getFormatTitle()}
          </DialogTitle>
          {!exportComplete && (
            <DialogDescription>
              {receipts.length} Belege
              {dateRange?.from && dateRange?.to && (
                <> im Zeitraum {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}</>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exportComplete ? (
          <div className="py-8 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Export erfolgreich!</p>
              <p className="text-muted-foreground">
                {exportedCount} Belege exportiert
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Schließen
            </Button>
          </div>
        ) : isExporting && exportFormat === 'zip' ? (
          <div className="py-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Verarbeite Beleg {currentItem} von {receipts.length}...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentFileName && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {currentFileName}
                </p>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
          </div>
        ) : (
          <>
            <div className="py-4 space-y-4">
              {/* Template selection (not for ZIP) */}
              {exportFormat !== 'zip' && (
                <div>
                  <Label>Export-Vorlage</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vorlage wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                          Standard (alle Spalten)
                        </div>
                      </SelectItem>

                      {templates.length > 0 && <SelectSeparator />}

                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <Table className="w-4 h-4 text-primary" />
                            <span>{template.name}</span>
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Standard
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}

                      {templates.length === 0 && (
                        <>
                          <SelectSeparator />
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Keine eigenen Vorlagen vorhanden
                          </div>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Template preview */}
                  {selectedTemplate && (
                    <div className="mt-2 p-2 bg-muted/50 rounded border text-xs">
                      <p className="font-medium text-muted-foreground mb-1">
                        Spalten ({visibleColumns.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {visibleColumns.slice(0, 8).map((col, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {col.label}
                          </Badge>
                        ))}
                        {visibleColumns.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{visibleColumns.length - 8} weitere
                          </Badge>
                        )}
                      </div>
                      {selectedTemplate.group_by && (
                        <p className="mt-1 text-muted-foreground">
                          Gruppiert nach: {getGroupLabel(selectedTemplate.group_by)}
                        </p>
                      )}
                      {selectedTemplate.sort_by && (
                        <p className="text-muted-foreground">
                          Sortiert nach: {selectedTemplate.sort_by} ({selectedTemplate.sort_direction === 'asc' ? '↑' : '↓'})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Folder Selection */}
              {supportsDirectoryPicker && (
                <div className="space-y-2">
                  <Label>Zielordner</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={exportFolder === 'downloads' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setExportFolder('downloads');
                          setSelectedFolderHandle(null);
                          setSelectedFolderName('');
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Downloads
                      </Button>
                      <Button
                        variant={exportFolder === 'custom' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => selectFolder()}
                      >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Ordner wählen
                      </Button>
                    </div>
                    {exportFolder === 'custom' && selectedFolderName && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded border text-sm">
                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{selectedFolderName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 w-6 p-0"
                          onClick={selectFolder}
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {exportFolder === 'custom' && selectedFolderHandle && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="includeSubfolder" className="text-xs">Unterordner erstellen (nach Zeitraum)</Label>
                        <Switch
                          id="includeSubfolder"
                          checked={includeSubfolder}
                          onCheckedChange={setIncludeSubfolder}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {exportFormat !== 'zip' && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="includeHeader">Kopfzeile einschließen</Label>
                      <Switch
                        id="includeHeader"
                        checked={includeHeader}
                        onCheckedChange={setIncludeHeader}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="includeTotals">Summenzeile am Ende</Label>
                      <Switch
                        id="includeTotals"
                        checked={includeTotals}
                        onCheckedChange={setIncludeTotals}
                      />
                    </div>
                  </>
                )}

                {/* Exclude "Keine Rechnung" option (not for ZIP) */}
                {exportFormat !== 'zip' && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="excludeNoReceipt">„Keine Rechnung" ausschließen</Label>
                    <Switch
                      id="excludeNoReceipt"
                      checked={excludeNoReceipt}
                      onCheckedChange={setExcludeNoReceipt}
                    />
                  </div>
                )}

                {/* Split bookings option (only when feature enabled, not for ZIP) */}
                {splitBookingEnabled && exportFormat !== 'zip' && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="expandSplitBookings">Splitbuchungen aufteilen</Label>
                      <p className="text-xs text-muted-foreground">
                        Split-Belege erzeugen mehrere Zeilen
                      </p>
                    </div>
                    <Switch
                      id="expandSplitBookings"
                      checked={expandSplitBookings}
                      onCheckedChange={setExpandSplitBookings}
                    />
                  </div>
                )}

                {exportFormat === 'zip' && (
                  <>
                    <div>
                      <Label>Ordnerstruktur</Label>
                      <Select value={zipStructure} onValueChange={(v) => setZipStructure(v as typeof zipStructure)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Alle in einem Ordner</SelectItem>
                          <SelectItem value="month">Nach Monat (2024-01, 2024-02, ...)</SelectItem>
                          <SelectItem value="category">Nach Kategorie</SelectItem>
                          <SelectItem value="vendor">Nach Lieferant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="renameFiles">Dateien umbenennen</Label>
                      <Switch
                        id="renameFiles"
                        checked={renameFiles}
                        onCheckedChange={setRenameFiles}
                      />
                    </div>

                    {renameFiles && (
                      <div className="flex items-center gap-2 p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                        <Settings className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Benennungsregel kann in den{' '}
                          <button 
                            onClick={() => {
                              onOpenChange(false);
                              navigate('/settings');
                            }}
                            className="text-primary hover:underline font-medium"
                          >
                            Einstellungen
                          </button>
                          {' '}angepasst werden.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Preview */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Export-Vorschau:</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• {receipts.length} Belege werden exportiert</p>
                  {exportFormat !== 'zip' && selectedTemplateId !== 'default' && selectedTemplate && (
                    <p>• {visibleColumns.length} Spalten gemäß Vorlage</p>
                  )}
                  <p>• {getFormatInfo()}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={executeExport} disabled={isExporting || receipts.length === 0}>
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exportiere...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Exportieren
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
