import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Vendor } from '@/hooks/useVendors';

interface UserCategory {
  id: string;
  name: string;
}

interface VendorImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingVendors: Vendor[];
  userCategories: UserCategory[];
  onImported: () => void;
}

interface ParsedRow {
  rowIndex: number;
  vendor_number: string | null;
  display_name: string;
  legal_names: string[];
  website: string | null;
  notes: string | null;
  default_category_id: string | null;
  default_category_name: string | null;
  default_vat_rate: number | null;
  default_tax_type: string | null;
  extraction_keywords: string[];
  status: 'new' | 'update' | 'error';
  matchedVendorId?: string;
  errors: string[];
  warnings: string[];
}

// Header alias resolution (case-insensitive, trims, ignores diacritics)
const norm = (s: string) =>
  s.toLowerCase().trim().replace(/[äÄ]/g, 'a').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u').replace(/[ß]/g, 'ss');

const HEADER_MAP: Record<string, string> = {};
const addAliases = (field: string, aliases: string[]) => {
  for (const a of aliases) HEADER_MAP[norm(a)] = field;
};
addAliases('vendor_number', ['Lieferantennummer', 'Lieferanten-Nr', 'Lieferanten Nr', 'Nr', 'Nummer', 'Number', 'Vendor Number', 'Vendor No', 'Kreditorennummer']);
addAliases('display_name', ['Anzeigename', 'Markenname', 'Name', 'Display Name', 'Vendor', 'Lieferant', 'Firma']);
addAliases('legal_names', ['Rechtsname', 'Rechtliche Namen', 'Legal Name', 'Legal Names', 'Firmenname', 'Firmennamen']);
addAliases('website', ['Website', 'URL', 'Webseite', 'Web']);
addAliases('notes', ['Notizen', 'Notes', 'Bemerkung', 'Bemerkungen', 'Anmerkung']);
addAliases('category', ['Kategorie', 'Category', 'Standardkategorie', 'Standard-Kategorie']);
addAliases('default_vat_rate', ['MwSt', 'MwSt-Satz', 'USt', 'USt-Satz', 'VAT', 'VAT Rate', 'Steuersatz']);
addAliases('default_tax_type', ['Steuerart', 'Tax Type', 'Steuertyp']);
addAliases('extraction_keywords', ['Stichwörter', 'Stichworte', 'Schlagworte', 'Keywords', 'Extraktions-Stichwörter']);

const TEMPLATE_HEADERS = [
  'Lieferantennummer',
  'Anzeigename',
  'Rechtsname',
  'Website',
  'Notizen',
  'Kategorie',
  'MwSt-Satz',
  'Steuerart',
  'Stichwörter',
];

const TEMPLATE_EXAMPLES = [
  ['L-001', 'Amazon', 'Amazon EU S.à.r.l.', 'https://amazon.de', 'Online-Shop', 'Büromaterial', 20, 'standard', 'amazon, amzn'],
  ['L-002', 'Spusu', 'Mass Response Service GmbH', 'https://spusu.at', '', 'Telekommunikation', 20, 'standard', 'spusu'],
];

function parseList(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const s = String(value).replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function VendorImportDialog({
  open,
  onOpenChange,
  existingVendors,
  userCategories,
  onImported,
}: VendorImportDialogProps) {
  const { user } = useAuth();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);

  const reset = () => {
    setParsedRows([]);
    setFileName('');
    setUnknownHeaders([]);
    setProgress({ done: 0, total: 0 });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lieferanten');
    XLSX.writeFile(wb, 'lieferanten-vorlage.xlsx');
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        toast.error('Die Datei enthält keine Daten');
        return;
      }

      // Determine column->field mapping
      const firstRow = rows[0];
      const colToField: Record<string, string> = {};
      const unknown: string[] = [];
      for (const header of Object.keys(firstRow)) {
        const field = HEADER_MAP[norm(header)];
        if (field) colToField[header] = field;
        else unknown.push(header);
      }
      setUnknownHeaders(unknown);

      // Build category lookup
      const catLookup = new Map<string, string>();
      for (const c of userCategories) catLookup.set(c.name.toLowerCase(), c.id);

      // Build vendor lookups
      const vendorByNumber = new Map<string, Vendor>();
      const vendorByName = new Map<string, Vendor>();
      for (const v of existingVendors) {
        if (v.vendor_number) vendorByNumber.set(v.vendor_number.toLowerCase(), v);
        vendorByName.set(v.display_name.toLowerCase(), v);
      }

      const seenNumbers = new Set<string>();
      const seenNames = new Set<string>();

      const parsed: ParsedRow[] = rows.map((row, idx) => {
        const mapped: Partial<Record<string, unknown>> = {};
        for (const [col, field] of Object.entries(colToField)) {
          mapped[field] = row[col];
        }

        const display_name = String(mapped.display_name ?? '').trim();
        const vendor_number = mapped.vendor_number ? String(mapped.vendor_number).trim() : null;
        const legal_names = parseList(mapped.legal_names);
        const website = mapped.website ? String(mapped.website).trim() : null;
        const notes = mapped.notes ? String(mapped.notes).trim() : null;
        const category_name_raw = mapped.category ? String(mapped.category).trim() : null;
        const default_category_id = category_name_raw ? (catLookup.get(category_name_raw.toLowerCase()) || null) : null;
        const default_vat_rate = parseNumber(mapped.default_vat_rate);
        const default_tax_type = mapped.default_tax_type ? String(mapped.default_tax_type).trim() : null;
        const extraction_keywords = parseList(mapped.extraction_keywords);

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!display_name) errors.push('Anzeigename fehlt');
        if (display_name.length > 200) errors.push('Anzeigename zu lang (max 200)');
        if (vendor_number && vendor_number.length > 50) errors.push('Lieferantennummer zu lang (max 50)');
        if (default_vat_rate !== null && (default_vat_rate < 0 || default_vat_rate > 100)) {
          errors.push('MwSt-Satz muss zwischen 0 und 100 liegen');
        }
        if (category_name_raw && !default_category_id) {
          warnings.push(`Kategorie "${category_name_raw}" nicht gefunden – wird ignoriert`);
        }

        // Duplicate in file
        if (vendor_number) {
          const key = vendor_number.toLowerCase();
          if (seenNumbers.has(key)) errors.push('Lieferantennummer doppelt in Datei');
          else seenNumbers.add(key);
        }
        if (display_name) {
          const key = display_name.toLowerCase();
          if (seenNames.has(key)) errors.push('Anzeigename doppelt in Datei');
          else seenNames.add(key);
        }

        // Match existing
        let matchedVendor: Vendor | undefined;
        if (vendor_number) matchedVendor = vendorByNumber.get(vendor_number.toLowerCase());
        if (!matchedVendor && display_name) matchedVendor = vendorByName.get(display_name.toLowerCase());

        let status: ParsedRow['status'] = 'new';
        if (errors.length > 0) status = 'error';
        else if (matchedVendor) status = 'update';

        return {
          rowIndex: idx + 2, // +2 because header is row 1, data starts at 2
          vendor_number,
          display_name,
          legal_names,
          website,
          notes,
          default_category_id,
          default_category_name: category_name_raw,
          default_vat_rate,
          default_tax_type,
          extraction_keywords,
          status,
          matchedVendorId: matchedVendor?.id,
          errors,
          warnings,
        };
      });

      setParsedRows(parsed);
    } catch (e) {
      console.error(e);
      toast.error('Datei konnte nicht gelesen werden');
    }
  };

  const stats = useMemo(() => {
    let news = 0, updates = 0, errs = 0;
    for (const r of parsedRows) {
      if (r.status === 'new') news++;
      else if (r.status === 'update') updates++;
      else errs++;
    }
    return { news, updates, errs };
  }, [parsedRows]);

  const runImport = async () => {
    if (!user) return;
    const toCreate = parsedRows.filter(r => r.status === 'new');
    const toUpdate = updateExisting ? parsedRows.filter(r => r.status === 'update') : [];

    const total = toCreate.length + toUpdate.length;
    if (total === 0) {
      toast.info('Nichts zu importieren');
      return;
    }

    setIsImporting(true);
    setProgress({ done: 0, total });
    let created = 0;
    let updated = 0;
    let failed = 0;

    try {
      // Inserts in batches of 50
      const batchSize = 50;
      for (let i = 0; i < toCreate.length; i += batchSize) {
        const batch = toCreate.slice(i, i + batchSize).map(r => ({
          user_id: user.id,
          display_name: r.display_name,
          vendor_number: r.vendor_number,
          legal_names: r.legal_names,
          website: r.website,
          notes: r.notes,
          default_category_id: r.default_category_id,
          default_vat_rate: r.default_vat_rate,
          default_tax_type: r.default_tax_type,
          extraction_keywords: r.extraction_keywords,
        }));
        const { error, data } = await supabase.from('vendors').insert(batch as never).select('id');
        if (error) {
          console.error('Insert batch failed:', error);
          failed += batch.length;
        } else {
          created += data?.length || 0;
        }
        setProgress(p => ({ ...p, done: p.done + batch.length }));
      }

      // Updates one-by-one (different ids)
      for (const r of toUpdate) {
        if (!r.matchedVendorId) continue;
        const update: Record<string, unknown> = {
          display_name: r.display_name,
          vendor_number: r.vendor_number,
        };
        if (r.legal_names.length > 0) update.legal_names = r.legal_names;
        if (r.website) update.website = r.website;
        if (r.notes) update.notes = r.notes;
        if (r.default_category_id) update.default_category_id = r.default_category_id;
        if (r.default_vat_rate !== null) update.default_vat_rate = r.default_vat_rate;
        if (r.default_tax_type) update.default_tax_type = r.default_tax_type;
        if (r.extraction_keywords.length > 0) update.extraction_keywords = r.extraction_keywords;

        const { error } = await supabase.from('vendors').update(update as never).eq('id', r.matchedVendorId);
        if (error) {
          console.error('Update failed:', error);
          failed++;
        } else {
          updated++;
        }
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`${created} neu`);
      if (updated > 0) parts.push(`${updated} aktualisiert`);
      if (failed > 0) parts.push(`${failed} fehlgeschlagen`);
      toast.success(`Import abgeschlossen`, { description: parts.join(' · ') || 'Keine Änderungen' });

      onImported();
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Import fehlgeschlagen');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lieferanten aus Excel importieren</DialogTitle>
          <DialogDescription>
            Lade eine Excel- oder CSV-Datei hoch. Lieferanten werden anhand der Lieferantennummer
            oder des Anzeigenamens abgeglichen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Vorlage herunterladen
            </Button>
            <label className="inline-flex items-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md cursor-pointer hover:bg-muted">
                <Upload className="h-4 w-4" />
                Datei wählen
              </span>
            </label>
            {fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
              </span>
            )}
          </div>

          {unknownHeaders.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              Unbekannte Spalten (werden ignoriert): {unknownHeaders.join(', ')}
            </div>
          )}

          {parsedRows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {stats.news} neu
                </Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  {stats.updates} bestehend
                </Badge>
                {stats.errs > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats.errs} Fehler
                  </Badge>
                )}
                <div className="flex-1" />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={updateExisting}
                    onCheckedChange={(c) => setUpdateExisting(Boolean(c))}
                  />
                  Bestehende Lieferanten aktualisieren
                </label>
              </div>

              <div className="border rounded-lg max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[60px]">Zeile</TableHead>
                      <TableHead className="w-[90px]">Status</TableHead>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Anzeigename</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>MwSt</TableHead>
                      <TableHead>Hinweise</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((r) => (
                      <TableRow key={r.rowIndex}>
                        <TableCell className="text-xs text-muted-foreground">{r.rowIndex}</TableCell>
                        <TableCell>
                          {r.status === 'new' && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                              Neu
                            </Badge>
                          )}
                          {r.status === 'update' && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                              Update
                            </Badge>
                          )}
                          {r.status === 'error' && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                              Fehler
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.vendor_number || '–'}</TableCell>
                        <TableCell className="text-sm">{r.display_name || '–'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.default_category_name || '–'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.default_vat_rate !== null ? `${r.default_vat_rate}%` : '–'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.errors.map((e, i) => (
                            <div key={`e${i}`} className="text-destructive">{e}</div>
                          ))}
                          {r.warnings.map((w, i) => (
                            <div key={`w${i}`} className="text-muted-foreground">{w}</div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {isImporting && progress.total > 0 && (
            <div className="text-sm text-muted-foreground">
              Importiere {progress.done} / {progress.total}…
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isImporting}>
            Abbrechen
          </Button>
          <Button
            onClick={runImport}
            disabled={isImporting || parsedRows.length === 0 || (stats.news === 0 && (!updateExisting || stats.updates === 0))}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Importieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
