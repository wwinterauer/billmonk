import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronsUpDown, Search, Plus } from 'lucide-react';

interface BrandVendor {
  id: string;
  display_name: string;
  legal_names: string[] | null;
  receipt_count: number;
}

interface Props {
  value: string;
  onChange: (brand: string) => void;
  /** Called when user picks an existing brand from the dropdown */
  onBrandSelect?: (vendor: BrandVendor) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
}

export function VendorBrandAutocomplete({
  value,
  onChange,
  onBrandSelect,
  disabled = false,
  hideLabel = false,
  placeholder = 'z.B. Amazon, timr, A1',
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<BrandVendor[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: vData } = await supabase
        .from('vendors')
        .select('id, display_name, legal_names')
        .eq('user_id', user.id);
      const { data: rData } = await supabase
        .from('receipts')
        .select('vendor_id')
        .eq('user_id', user.id)
        .not('vendor_id', 'is', null);
      const counts: Record<string, number> = {};
      (rData || []).forEach(r => {
        if (r.vendor_id) counts[r.vendor_id] = (counts[r.vendor_id] || 0) + 1;
      });
      const list = (vData || []).map(v => ({
        id: v.id,
        display_name: v.display_name,
        legal_names: v.legal_names,
        receipt_count: counts[v.id] || 0,
      }));
      // Group by display_name (one entry per brand, keep most-used)
      const byBrand = new Map<string, BrandVendor>();
      for (const v of list) {
        const key = v.display_name.toLowerCase();
        const ex = byBrand.get(key);
        if (!ex || ex.receipt_count < v.receipt_count) byBrand.set(key, v);
      }
      const arr = Array.from(byBrand.values()).sort((a, b) => b.receipt_count - a.receipt_count);
      setVendors(arr);
    })();
  }, [user]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vendors.slice(0, 10);
    return vendors
      .filter(v => v.display_name.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.display_name.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.display_name.toLowerCase().startsWith(q) ? 0 : 1;
        if (as !== bs) return as - bs;
        return b.receipt_count - a.receipt_count;
      })
      .slice(0, 10);
  }, [search, vendors]);

  const isExact = filtered.some(v => v.display_name.toLowerCase() === search.toLowerCase());

  return (
    <div className="relative" ref={containerRef}>
      {!hideLabel && <Label className="mb-1.5 block">Marke</Label>}
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setSearch(value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="pr-10"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={() => {
            if (disabled) return;
            setOpen(!open);
            if (!open) {
              setSearch('');
              inputRef.current?.focus();
            }
          }}
          disabled={disabled}
        >
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-hidden">
          <div className="p-2 border-b border-border bg-muted/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Marke suchen..."
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Keine Marke gefunden
              </div>
            ) : (
              filtered.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-3 border-b border-border last:border-b-0 transition-colors"
                  onClick={() => {
                    onChange(v.display_name);
                    onBrandSelect?.(v);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{v.display_name}</p>
                    {v.legal_names && v.legal_names.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {v.legal_names.length} Händler: {v.legal_names.slice(0, 2).join(', ')}
                        {v.legal_names.length > 2 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {v.receipt_count} Belege
                  </span>
                </button>
              ))
            )}
          </div>
          {search && !isExact && (
            <div className="p-2 border-t border-border bg-muted/50">
              <div className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-2">
                <Plus className="w-3 h-3" />
                Marke "{search}" wird beim Speichern angelegt
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
