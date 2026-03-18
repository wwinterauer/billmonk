import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NO_RECEIPT_CATEGORY } from '@/lib/constants';

interface DashboardStats {
  totalExpenses: number;
  previousMonthExpenses: number;
  totalVat: number;
  receiptCount: number;
  openReceiptCount: number;
  reviewReceiptCount: number;
  avgAiConfidence: number | null;
  unmatchedTransactions: number;
  // Invoice stats (Business plan)
  totalIncome: number;
  openInvoiceCount: number;
  openInvoiceAmount: number;
  paidThisMonth: number;
}

interface CategoryData {
  category: string;
  total: number;
  color: string | null;
}

interface TagData {
  id: string;
  name: string;
  color: string;
  total: number;
  count: number;
}

interface RecentReceipt {
  id: string;
  receipt_date: string | null;
  created_at: string;
  vendor: string | null;
  amount_gross: number | null;
  status: string;
}

export function useDashboardData(year: number, month: number) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    previousMonthExpenses: 0,
    totalVat: 0,
    receiptCount: 0,
    openReceiptCount: 0,
    reviewReceiptCount: 0,
    avgAiConfidence: null,
    unmatchedTransactions: 0,
    totalIncome: 0,
    openInvoiceCount: 0,
    openInvoiceAmount: 0,
    paidThisMonth: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [tagData, setTagData] = useState<TagData[]>([]);
  const [untaggedTotal, setUntaggedTotal] = useState(0);
  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);

  const fetchDashboardData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Date ranges
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const startOfPrevMonth = new Date(year, month - 2, 1);
      const endOfPrevMonth = new Date(year, month - 1, 0);

      // Fetch current month receipts
      const { data: currentMonthReceipts, error: currentError } = await supabase
        .from('receipts')
        .select('id, amount_gross, vat_amount, status, ai_confidence, category')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (currentError) throw currentError;

      // Fetch previous month receipts for comparison
      const { data: prevMonthReceipts, error: prevError } = await supabase
        .from('receipts')
        .select('amount_gross, category')
        .eq('user_id', user.id)
        .gte('created_at', startOfPrevMonth.toISOString())
        .lte('created_at', endOfPrevMonth.toISOString());

      if (prevError) throw prevError;

      // Fetch unmatched bank transactions
      const { count: unmatchedCount, error: unmatchedError } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'unmatched');

      if (unmatchedError) throw unmatchedError;

      // Fetch recent receipts
      const { data: recent, error: recentError } = await supabase
        .from('receipts')
        .select('id, receipt_date, created_at, vendor, amount_gross, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      // Fetch categories for colors
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('name, color');

      if (catError) throw catError;

      // Fetch receipt tags for the current month (with tag details and receipt amounts)
      const { data: receiptTags, error: tagsError } = await supabase
        .from('receipt_tags')
        .select(`
          tag:tags(id, name, color),
          receipt:receipts(id, amount_gross, created_at, user_id)
        `)
        .gte('receipt.created_at', startOfMonth.toISOString())
        .lte('receipt.created_at', endOfMonth.toISOString());

      if (tagsError) throw tagsError;

      // Calculate stats (exclude "Keine Rechnung" from monetary calculations)
      const receipts = currentMonthReceipts || [];
      const billableReceipts = receipts.filter(r => r.category !== NO_RECEIPT_CATEGORY);
      const totalExpenses = billableReceipts.reduce((sum, r) => sum + (r.amount_gross || 0), 0);
      const totalVat = billableReceipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
      const receiptCount = receipts.length;
      const openReceiptCount = receipts.filter(r => r.status === 'pending' || r.status === 'processing').length;
      const reviewReceiptCount = receipts.filter(r => r.status === 'review').length;
      
      const confidenceValues = receipts
        .filter(r => r.ai_confidence !== null)
        .map(r => r.ai_confidence as number);
      const avgAiConfidence = confidenceValues.length > 0 
        ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length 
        : null;

      const previousMonthExpenses = (prevMonthReceipts || [])
        .filter(r => (r as any).category !== NO_RECEIPT_CATEGORY)
        .reduce((sum, r) => sum + (r.amount_gross || 0), 0);

      // Calculate category totals (exclude "Keine Rechnung")
      const categoryMap = new Map<string, number>();
      billableReceipts.forEach(r => {
        if (r.category) {
          const current = categoryMap.get(r.category) || 0;
          categoryMap.set(r.category, current + (r.amount_gross || 0));
        }
      });

      const categoryColors = new Map(categories?.map(c => [c.name, c.color]) || []);
      const catData: CategoryData[] = Array.from(categoryMap.entries())
        .map(([category, total]) => ({
          category,
          total,
          color: categoryColors.get(category) || null,
        }))
        .sort((a, b) => b.total - a.total);

      // Calculate tag totals
      const tagMap = new Map<string, { id: string; name: string; color: string; total: number; count: number }>();
      const taggedReceiptIds = new Set<string>();

      (receiptTags || []).forEach((rt: { tag: { id: string; name: string; color: string } | null; receipt: { id: string; amount_gross: number | null; user_id: string } | null }) => {
        if (!rt.tag || !rt.receipt) return;
        if (rt.receipt.user_id !== user.id) return;

        const tag = rt.tag;
        taggedReceiptIds.add(rt.receipt.id);

        const existing = tagMap.get(tag.id);
        if (existing) {
          existing.total += rt.receipt.amount_gross || 0;
          existing.count += 1;
        } else {
          tagMap.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            total: rt.receipt.amount_gross || 0,
            count: 1,
          });
        }
      });

      const tagDataArray: TagData[] = Array.from(tagMap.values())
        .sort((a, b) => b.total - a.total);

      // Calculate untagged receipts total
      const untaggedAmount = receipts
        .filter(r => !taggedReceiptIds.has(r.id))
        .reduce((sum, r) => sum + (r.amount_gross || 0), 0);

      setStats({
        totalExpenses,
        previousMonthExpenses,
        totalVat,
        receiptCount,
        openReceiptCount,
        reviewReceiptCount,
        avgAiConfidence,
        unmatchedTransactions: unmatchedCount || 0,
      });

      setCategoryData(catData);
      setTagData(tagDataArray);
      setUntaggedTotal(untaggedAmount);
      setRecentReceipts((recent || []) as RecentReceipt[]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, year, month]);

  // Calculate percentage change
  const percentageChange = useMemo(() => {
    if (stats.previousMonthExpenses === 0) return null;
    const change = ((stats.totalExpenses - stats.previousMonthExpenses) / stats.previousMonthExpenses) * 100;
    return Math.round(change);
  }, [stats.totalExpenses, stats.previousMonthExpenses]);

  return {
    loading,
    error,
    stats,
    categoryData,
    tagData,
    untaggedTotal,
    recentReceipts,
    percentageChange,
    refetch: fetchDashboardData,
  };
}
