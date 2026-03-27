import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface RecurringExpense {
  id: string;
  user_id: string;
  vendor_name: string;
  category_id: string | null;
  average_amount: number;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  last_seen_date: string | null;
  next_expected_date: string | null;
  confidence: number;
  status: 'detected' | 'confirmed' | 'dismissed' | 'paused' | 'cancelled';
  is_user_confirmed: boolean;
  notes: string | null;
  matched_description: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
}

export function useRecurringExpenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, categories(id, name, color, icon)')
        .eq('user_id', user.id)
        .neq('status', 'dismissed')
        .order('average_amount', { ascending: false });

      if (error) throw error;

      setExpenses((data || []).map((d: any) => ({
        ...d,
        category: d.categories || null,
      })));
    } catch (err) {
      console.error('Error fetching recurring expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const runDetection = async () => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-recurring-expenses');
      if (error) throw error;
      toast({ title: 'Analyse abgeschlossen', description: `${data?.detected || 0} neue Muster erkannt.` });
      await fetchExpenses();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Analyse konnte nicht gestartet werden.' });
    } finally {
      setDetecting(false);
    }
  };

  const updateStatus = async (id: string, status: string, isConfirmed?: boolean) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (isConfirmed !== undefined) updates.is_user_confirmed = isConfirmed;

    const { error } = await supabase
      .from('recurring_expenses')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
      return;
    }

    if (status === 'dismissed') {
      setExpenses(prev => prev.filter(e => e.id !== id));
    } else {
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
      return;
    }
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, notes } : e));
  };

  const updateCategory = async (id: string, categoryId: string | null) => {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ category_id: categoryId, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
      return;
    }
    await fetchExpenses();
  };

  // Calculate monthly fixed costs
  const monthlyFixedCosts = expenses
    .filter(e => e.status === 'confirmed')
    .reduce((sum, e) => {
      switch (e.frequency) {
        case 'monthly': return sum + e.average_amount;
        case 'quarterly': return sum + e.average_amount / 3;
        case 'semi_annual': return sum + e.average_amount / 6;
        case 'annual': return sum + e.average_amount / 12;
        default: return sum;
      }
    }, 0);

  // Find overdue or amount-changed alerts
  const alerts = expenses
    .filter(e => e.status === 'confirmed')
    .reduce<{ id: string; type: 'overdue' | 'amount_changed'; message: string }[]>((acc, e) => {
      if (e.next_expected_date && new Date(e.next_expected_date) < new Date()) {
        acc.push({
          id: e.id,
          type: 'overdue',
          message: `${e.vendor_name}: Zahlung überfällig (erwartet am ${new Date(e.next_expected_date).toLocaleDateString('de-AT')})`,
        });
      }
      return acc;
    }, []);

  return {
    expenses,
    loading,
    detecting,
    monthlyFixedCosts,
    alerts,
    runDetection,
    updateStatus,
    updateNotes,
    updateCategory,
    fetchExpenses,
  };
}
