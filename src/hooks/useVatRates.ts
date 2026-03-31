import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VatRate {
  value: string;
  label: string;
}

export interface VatRateGroup {
  label: string;
  rates: VatRate[];
}

const DACH_RATES: Record<string, VatRateGroup> = {
  AT: {
    label: 'Österreich',
    rates: [
      { value: '20', label: '20% (Normal)' },
      { value: '13', label: '13% (Ermäßigt)' },
      { value: '10', label: '10% (Ermäßigt)' },
    ],
  },
  DE: {
    label: 'Deutschland',
    rates: [
      { value: '19', label: '19% (Normal)' },
      { value: '7', label: '7% (Ermäßigt)' },
    ],
  },
  CH: {
    label: 'Schweiz',
    rates: [
      { value: '8.1', label: '8.1% (Normal)' },
      { value: '3.8', label: '3.8% (Beherbergung)' },
      { value: '2.6', label: '2.6% (Ermäßigt)' },
    ],
  },
};

const ALL_DACH_VALUES = new Set(
  Object.values(DACH_RATES).flatMap(g => g.rates.map(r => r.value))
);

export function useVatRates() {
  const { user } = useAuth();

  // Load user country from profiles
  const { data: userCountry } = useQuery({
    queryKey: ['profile-country', user?.id],
    queryFn: async () => {
      if (!user?.id) return 'AT';
      const { data } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();
      return data?.country || 'AT';
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Load unique tax_rate values from user's receipts
  const { data: receiptRates, isLoading } = useQuery({
    queryKey: ['receipt-tax-rates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('receipts')
        .select('vat_rate')
        .eq('user_id', user.id)
        .in('status', ['approved', 'completed'])
        .not('vat_rate', 'is', null);
      
      if (!data) return [];
      
      const unique = new Set<string>();
      data.forEach(r => {
        const rate = String(r.vat_rate).trim();
        if (rate && rate !== 'unknown' && rate !== 'mixed' && rate !== '0') {
          unique.add(rate);
        }
      });
      return Array.from(unique).sort((a, b) => parseFloat(b) - parseFloat(a));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const country = userCountry || 'AT';
  const defaultVatRate = useMemo(() => {
    const group = DACH_RATES[country];
    return group?.rates[0]?.value || '20';
  }, [country]);
  const vatRateGroups = useMemo<VatRateGroup[]>(() => {
    // 1. DACH groups sorted by user country first
    const dachOrder = [country, ...['AT', 'DE', 'CH'].filter(c => c !== country)];
    const groups: VatRateGroup[] = dachOrder
      .filter(c => DACH_RATES[c])
      .map(c => DACH_RATES[c]);

    // 2. Additional rates from receipts not in DACH
    const extraRates = (receiptRates || [])
      .filter(v => !ALL_DACH_VALUES.has(v))
      .map(v => ({ value: v, label: `${v}%` }));

    if (extraRates.length > 0) {
      groups.push({ label: 'Weitere erkannte Sätze', rates: extraRates });
    }

    // 3. Always append 0% and Gemischt
    groups.push({
      label: 'Sonstige',
      rates: [
        { value: '0', label: '0% (Steuerfrei)' },
        { value: 'mixed', label: 'Gemischt (mehrere)' },
      ],
    });

    return groups;
  }, [country, receiptRates]);

  const vatRates = useMemo<VatRate[]>(
    () => vatRateGroups.flatMap(g => g.rates),
    [vatRateGroups]
  );

  return { vatRateGroups, vatRates, defaultVatRate, loading: isLoading };
}
