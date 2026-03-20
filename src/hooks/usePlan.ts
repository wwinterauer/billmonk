import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PlanType, PLAN_LIMITS, PLAN_FEATURES, PLAN_NAMES } from '@/lib/planConfig';

export interface PlanData {
  plan: PlanType;
  effectivePlan: PlanType;
  isAdmin: boolean;
  adminViewPlan: PlanType | null;
  hasStripeCustomer: boolean;
  receiptsUsed: number;
  receiptsCredit: number;
  receiptsLimit: number;
  receiptsAvailable: number;
  documentsUsed: number;
  documentsCredit: number;
  documentsLimit: number;
  documentsAvailable: number;
  features: typeof PLAN_FEATURES[PlanType];
  planName: string;
  loading: boolean;
  setAdminViewPlan: (plan: PlanType | null) => Promise<void>;
}

export function usePlan(): PlanData {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>('free');
  const [adminViewPlan, setAdminViewPlanState] = useState<PlanType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [receiptsUsed, setReceiptsUsed] = useState(0);
  const [receiptsCredit, setReceiptsCredit] = useState(0);
  const [documentsUsed, setDocumentsUsed] = useState(0);
  const [documentsCredit, setDocumentsCredit] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('plan, monthly_receipt_count, receipt_credit, admin_view_plan, monthly_document_count, document_credit')
      .eq('id', user.id)
      .single();

    if (data) {
      setPlan((data.plan as PlanType) || 'free');
      setReceiptsUsed(data.monthly_receipt_count || 0);
      setReceiptsCredit(data.receipt_credit || 0);
      setDocumentsUsed((data as any).monthly_document_count || 0);
      setDocumentsCredit((data as any).document_credit || 0);
      setAdminViewPlanState((data.admin_view_plan as PlanType) || null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const [, roleResult] = await Promise.all([
        fetchProfile(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
      ]);

      setIsAdmin(!!roleResult.data);
      setLoading(false);
    };

    fetchData();
  }, [user, fetchProfile]);

  // Periodically check subscription (every 60s) and on mount
  useEffect(() => {
    if (!user) return;

    const checkSub = async () => {
      try {
        await supabase.functions.invoke('check-subscription');
        // Re-fetch profile to get updated plan
        await fetchProfile();
      } catch {
        // Silent fail - subscription check is best-effort
      }
    };

    // Initial check
    checkSub();

    const interval = setInterval(checkSub, 60_000);
    return () => clearInterval(interval);
  }, [user, fetchProfile]);

  const effectivePlan: PlanType = isAdmin
    ? (adminViewPlan || 'business')
    : plan;

  const limits = PLAN_LIMITS[effectivePlan];
  const receiptsLimit = limits.receiptsPerMonth + receiptsCredit;
  const receiptsAvailable = Math.max(0, receiptsLimit - receiptsUsed);
  const documentsLimit = limits.documentsPerMonth + documentsCredit;
  const documentsAvailable = Math.max(0, documentsLimit - documentsUsed);

  const setAdminViewPlan = useCallback(async (newPlan: PlanType | null) => {
    if (!user || !isAdmin) return;
    setAdminViewPlanState(newPlan);
    await supabase
      .from('profiles')
      .update({ admin_view_plan: newPlan })
      .eq('id', user.id);
  }, [user, isAdmin]);

  return {
    plan,
    effectivePlan,
    isAdmin,
    adminViewPlan,
    receiptsUsed,
    receiptsCredit,
    receiptsLimit,
    receiptsAvailable,
    documentsUsed,
    documentsCredit,
    documentsLimit,
    documentsAvailable,
    features: PLAN_FEATURES[effectivePlan],
    planName: PLAN_NAMES[effectivePlan],
    loading,
    setAdminViewPlan,
  };
}
