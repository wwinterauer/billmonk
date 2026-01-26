import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronsUpDown, Search, Plus } from 'lucide-react';

interface VendorWithCategory {
  id: string;
  display_name: string;
  legal_name: string | null;
  detected_names: string[] | null;
  default_category_id: string | null;
  default_vat_rate: number | null;
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
}

export function VendorAutocomplete({
  value,
  vendorId,
  onChange,
  onVendorSelect,
  disabled = false,
}: VendorAutocompleteProps) {
  const { user } = useAuth();
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorWithCategory[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [allVendors, setAllVendors] = useState<VendorWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          id,
          display_name,
          legal_name,
          detected_names,
          default_category_id,
          default_vat_rate,
          receipt_count,
          default_category:categories(id, name, color)
        `)
        .order('receipt_count', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = (data || []).map(v => ({
        ...v,
        default_category: Array.isArray(v.default_category) 
          ? v.default_category[0] || null 
          : v.default_category
      })) as VendorWithCategory[];

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
        v.legal_name?.toLowerCase().includes(search) ||
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

  const handleUseCustomValue = () => {
    onChange(vendorSearch, null);
    setShowVendorDropdown(false);
  };

  const isExactMatch = vendorSuggestions.some(
    v => v.display_name.toLowerCase() === vendorSearch.toLowerCase()
  );

  return (
    <div className="relative" ref={containerRef}>
      <Label className="mb-1.5 block">Lieferant</Label>

      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            setVendorSearch(value);
            setShowVendorDropdown(true);
          }}
          placeholder="Lieferant eingeben oder auswählen..."
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
                      onClick={handleUseCustomValue}
                    >
                      "{vendorSearch}" verwenden
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
                    <p className="font-medium truncate">{vendor.display_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {vendor.legal_name && (
                        <span className="truncate max-w-[120px]">{vendor.legal_name}</span>
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
                onClick={handleUseCustomValue}
              >
                <Plus className="w-4 h-4 mr-2" />
                "{vendorSearch}" als neuen Lieferanten
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
