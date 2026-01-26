import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Vendor {
  id: string;
  user_id: string;
  display_name: string;
  legal_name: string | null;
  detected_names: string[];
  default_category_id: string | null;
  default_vat_rate: number | null;
  notes: string | null;
  website: string | null;
  receipt_count: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export function useVendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = async () => {
    if (!user) {
      setVendors([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch vendors
      const { data: vendorsData, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .order('display_name');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Fetch receipt statistics per vendor
      const { data: statsData, error: statsError } = await supabase
        .from('receipts')
        .select('vendor_id, amount_gross')
        .not('vendor_id', 'is', null);

      if (statsError) {
        console.error('Error fetching receipt stats:', statsError);
      }

      // Calculate stats per vendor
      const statsMap = new Map<string, { count: number; total: number }>();
      if (statsData) {
        for (const receipt of statsData) {
          if (receipt.vendor_id) {
            const existing = statsMap.get(receipt.vendor_id) || { count: 0, total: 0 };
            statsMap.set(receipt.vendor_id, {
              count: existing.count + 1,
              total: existing.total + (Number(receipt.amount_gross) || 0),
            });
          }
        }
      }

      const mappedData = (vendorsData || []).map(v => {
        const stats = statsMap.get(v.id);
        return {
          ...v,
          detected_names: v.detected_names || [],
          receipt_count: stats?.count ?? v.receipt_count ?? 0,
          total_amount: stats?.total ?? Number(v.total_amount) ?? 0,
        };
      }) as Vendor[];

      setVendors(mappedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Lieferanten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [user]);

  const addVendor = async (
    displayName: string,
    options?: {
      legalName?: string;
      detectedNames?: string[];
      defaultCategoryId?: string;
      defaultVatRate?: number;
      notes?: string;
      website?: string;
    }
  ): Promise<Vendor> => {
    if (!user) throw new Error('Nicht angemeldet');

    // Check for duplicate
    const existingVendor = vendors.find(
      v => v.display_name.toLowerCase() === displayName.toLowerCase()
    );
    if (existingVendor) {
      throw new Error('Ein Lieferant mit diesem Namen existiert bereits');
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        user_id: user.id,
        display_name: displayName,
        legal_name: options?.legalName || null,
        detected_names: options?.detectedNames || [],
        default_category_id: options?.defaultCategoryId || null,
        default_vat_rate: options?.defaultVatRate || null,
        notes: options?.notes || null,
        website: options?.website || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ein Lieferant mit diesem Namen existiert bereits');
      }
      throw new Error(error.message);
    }

    const newVendor = {
      ...data,
      detected_names: data.detected_names || [],
      receipt_count: data.receipt_count || 0,
      total_amount: Number(data.total_amount) || 0,
    } as Vendor;

    setVendors(prev => [...prev, newVendor].sort((a, b) => 
      a.display_name.localeCompare(b.display_name)
    ));
    return newVendor;
  };

  const updateVendor = async (
    id: string,
    updates: Partial<Pick<Vendor, 'display_name' | 'legal_name' | 'detected_names' | 'default_category_id' | 'default_vat_rate' | 'notes' | 'website'>>
  ): Promise<{ vendor: Vendor; syncedReceipts: number }> => {
    if (!user) throw new Error('Nicht angemeldet');

    // Check for duplicate if display_name is being updated
    if (updates.display_name) {
      const existingVendor = vendors.find(
        v => v.id !== id && v.display_name.toLowerCase() === updates.display_name!.toLowerCase()
      );
      if (existingVendor) {
        throw new Error('Ein Lieferant mit diesem Namen existiert bereits');
      }
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ein Lieferant mit diesem Namen existiert bereits');
      }
      throw new Error(error.message);
    }

    // Sync linked receipts with new vendor names
    let syncedReceipts = 0;
    if (updates.display_name !== undefined || updates.legal_name !== undefined) {
      const newLegalName = updates.legal_name !== undefined ? updates.legal_name : data.legal_name;
      const newBrandName = updates.display_name !== undefined ? updates.display_name : data.display_name;
      
      // Determine what to set on receipts:
      // - vendor = legal_name (or display_name as fallback)
      // - vendor_brand = display_name (only if different from legal_name)
      const receiptVendor = newLegalName || newBrandName;
      const receiptBrand = (newLegalName && newBrandName !== newLegalName) ? newBrandName : null;

      const { data: updateResult, error: syncError } = await supabase
        .from('receipts')
        .update({
          vendor: receiptVendor,
          vendor_brand: receiptBrand,
          updated_at: new Date().toISOString(),
        })
        .eq('vendor_id', id)
        .select('id');

      if (syncError) {
        console.error('Error syncing receipts:', syncError);
      } else {
        syncedReceipts = updateResult?.length || 0;
      }
    }

    const updated = {
      ...data,
      detected_names: data.detected_names || [],
      receipt_count: data.receipt_count || 0,
      total_amount: Number(data.total_amount) || 0,
    } as Vendor;

    setVendors(prev => prev.map(v => v.id === id ? updated : v).sort((a, b) => 
      a.display_name.localeCompare(b.display_name)
    ));
    return { vendor: updated, syncedReceipts };
  };

  const deleteVendor = async (id: string): Promise<void> => {
    if (!user) throw new Error('Nicht angemeldet');

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    setVendors(prev => prev.filter(v => v.id !== id));
  };

  return {
    vendors,
    loading,
    error,
    fetchVendors,
    addVendor,
    updateVendor,
    deleteVendor,
  };
}
