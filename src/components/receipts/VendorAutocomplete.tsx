import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronsUpDown, Search, Plus, Loader2 } from 'lucide-react';
import { createVendorInternal } from '@/services/vendorMatchingService';
import { toast } from 'sonner';

interface VendorWithCategory {
  id: string;
  display_name: string;
  legal_names: string[] | null;
  detected_names: string[] | null;
  default_category_id: string | null;
  default_tag_id: string | null;
  default_vat_rate: number | null;
  field_defaults: Record<string, string> | null;
  receipt_count: number | null;
  default_category: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface VendorAutocompleteProps {
  value: string;
  vendorId?: string | null;
  onChange: (value: string, vendorId?: string | null) => void;
  onVendorSelect: (vendor: VendorWithCategory) => void;
  disabled?: boolean;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
}

export function VendorAutocomplete({
  value,
  vendorId,
  onChange,
  onVendorSelect,
  disabled = false,
  label = 'Lieferant',
  hideLabel = false,
  placeholder = 'z.B. troii Software GmbH',
}: VendorAutocompleteProps) {
  const { user } = useAuth();
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorWithCategory[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [allVendors, setAllVendors] = useState<VendorWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all vendors on mount
  useEffect(() => {
    if (user) {
      loadAllVendors();
    }
  }, [user]);

  async function loadAllVendors() {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select(`
          id,
          display_name,
          legal_names,
          detected_names,
          default_category_id,
          default_tag_id,
          default_vat_rate,
          field_defaults,
          default_category:categories(id, name, color)
        `)
        .eq('user_id', user.id);

      if (vendorsError) throw vendorsError;

      // Load receipt counts per vendor (real-time aggregation)
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('receipts')
        .select('vendor_id')
        .eq('user_id', user.id)
        .not('vendor_id', 'is', null);

      if (receiptsError) throw receiptsError;

      // Count receipts per vendor
      const receiptCounts: Record<string, number> = {};
      (receiptsData || []).forEach(r => {
        if (r.vendor_id) {
          receiptCounts[r.vendor_id] = (receiptCounts[r.vendor_id] || 0) + 1;
        }
      });

      // Transform and combine the data
      const transformedData = (vendorsData || []).map(v => ({
        ...v,
        receipt_count: receiptCounts[v.id] || 0,
        default_category: Array.isArray(v.default_category) 
          ? v.default_category[0] || null 
          : v.default_category
      })) as VendorWithCategory[];

      // Sort by receipt count descending
      transformedData.sort((a, b) => (b.receipt_count || 0) - (a.receipt_count || 0));

      setAllVendors(transformedData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter vendors based on search
  useEffect(() => {
    if (!showVendorDropdown) return;

    const search = vendorSearch.toLowerCase().trim();

    if (search === '') {
      setVendorSuggestions(allVendors.slice(0, 10));
    } else {
      const filtered = allVendors.filter(v =>
        v.display_name.toLowerCase().includes(search) ||
        v.legal_names?.some(n => n.toLowerCase().includes(search)) ||
        v.detected_names?.some(n => n.toLowerCase().includes(search))
      );

      filtered.sort((a, b) => {
        const aStartsWith = a.display_name.toLowerCase().startsWith(search);
        const bStartsWith = b.display_name.toLowerCase().startsWith(search);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return (b.receipt_count || 0) - (a.receipt_count || 0);
      });

      setVendorSuggestions(filtered.slice(0, 10));
    }
  }, [vendorSearch, showVendorDropdown, allVendors]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowVendorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (newValue: string) => {
    onChange(newValue, null); // Clear vendor_id when typing manually
    setVendorSearch(newValue);
    setShowVendorDropdown(true);
  };

  const handleVendorClick = (vendor: VendorWithCategory) => {
    onVendorSelect(vendor);
    setShowVendorDropdown(false);
    setVendorSearch('');
  };

  const handleCreateNewVendor = async () => {
    const name = vendorSearch.trim();
    if (!user || name.length < 2 || isCreating) return;

    setIsCreating(true);
    try {
      const newVendor = await createVendorInternal(user.id, name);
      if (!newVendor) {
        toast.error('Anlegen fehlgeschlagen', {
          description: 'Bitte erneut versuchen.',
        });
        return;
      }

      // Reload list so the new vendor appears in future searches
      await loadAllVendors();

      // Map to VendorWithCategory shape and propagate selection
      const selected: VendorWithCategory = {
        id: newVendor.id,
        display_name: newVendor.display_name,
        legal_names: newVendor.legal_names ?? null,
        detected_names: newVendor.detected_names ?? null,
        default_category_id: newVendor.default_category_id ?? null,
        default_tag_id: (newVendor as any).default_tag_id ?? null,
        default_vat_rate: newVendor.default_vat_rate ?? null,
        field_defaults: (newVendor as any).field_defaults ?? null,
        receipt_count: 0,
        default_category: null,
      };

      onVendorSelect(selected);
      setShowVendorDropdown(false);
      setVendorSearch('');
      toast.success('Lieferant angelegt', { description: name });
    } catch (err: any) {
      console.error('Error creating vendor:', err);
      toast.error('Anlegen fehlgeschlagen', {
        description: err?.message || 'Bitte erneut versuchen.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const isExactMatch = vendorSuggestions.some(
    v => v.display_name.toLowerCase() === vendorSearch.toLowerCase()
  );

  return (
    <div className="relative" ref={containerRef}>
      {!hideLabel && <Label className="mb-1.5 block">{label}</Label>}

      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            setVendorSearch(value);
            setShowVendorDropdown(true);
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
            setShowVendorDropdown(!showVendorDropdown);
            if (!showVendorDropdown) {
              setVendorSearch('');
              inputRef.current?.focus();
            }
          }}
          disabled={disabled}
        >
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {showVendorDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-hidden"
        >
          <div className="p-2 border-b border-border bg-muted/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Lieferant suchen..."
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[240px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Laden...
              </div>
            ) : vendorSuggestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {vendorSearch ? (
                  <div>
                    <p>Kein Lieferant gefunden</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1"
                      onClick={handleCreateNewVendor}
                      disabled={isCreating || vendorSearch.trim().length < 2}
                    >
                      {isCreating ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Anlegen…</>
                      ) : (
                        <>"{vendorSearch}" als neuen Lieferanten anlegen</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p>Noch keine Lieferanten vorhanden</p>
                )}
              </div>
            ) : (
              vendorSuggestions.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 border-b border-border last:border-b-0 transition-colors"
                  onClick={() => handleVendorClick(vendor)}
                >
                  <div
                    className="w-1.5 h-8 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: vendor.default_category?.color || 'hsl(var(--muted))',
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {vendor.legal_names?.length ? vendor.legal_names[0] : vendor.display_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {vendor.legal_names?.length && vendor.legal_names[0] !== vendor.display_name && (
                        <span className="truncate max-w-[120px]">{vendor.display_name}</span>
                      )}
                      {vendor.default_category && (
                        <Badge variant="outline" className="text-xs py-0">
                          {vendor.default_category.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {vendor.receipt_count || 0} Belege
                  </span>
                </button>
              ))
            )}
          </div>

          {vendorSearch && !isExactMatch && (
            <div className="p-2 border-t border-border bg-muted/50">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary hover:text-primary"
                onClick={handleCreateNewVendor}
                disabled={isCreating || vendorSearch.trim().length < 2}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                "{vendorSearch}" als neuen Lieferanten anlegen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
