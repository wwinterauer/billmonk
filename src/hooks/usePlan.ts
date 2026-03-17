import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PlanType, PLAN_LIMITS, PLAN_FEATURES, PLAN_NAMES } from '@/lib/planConfig';

export interface PlanData {
  plan: PlanType;
  effectivePlan: PlanType;
  isAdmin: boolean;
  adminViewPlan: PlanType | null;
  receiptsUsed: number;
  receiptsCredit: number;
  receiptsLimit: number;
  receiptsAvailable: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // Fetch profile and admin status in parallel
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('plan, monthly_receipt_count, receipt_credit, admin_view_plan')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
      ]);

      if (profileResult.data) {
        const p = profileResult.data;
        setPlan((p.plan as PlanType) || 'free');
        setReceiptsUsed(p.monthly_receipt_count || 0);
        setReceiptsCredit(p.receipt_credit || 0);
        setAdminViewPlanState((p.admin_view_plan as PlanType) || null);
      }

      setIsAdmin(!!roleResult.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const effectivePlan: PlanType = isAdmin
    ? (adminViewPlan || 'business')
    : plan;

  const limits = PLAN_LIMITS[effectivePlan];
  const receiptsLimit = limits.receiptsPerMonth + receiptsCredit;
  const receiptsAvailable = Math.max(0, receiptsLimit - receiptsUsed);

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
    features: PLAN_FEATURES[effectivePlan],
    planName: PLAN_NAMES[effectivePlan],
    loading,
    setAdminViewPlan,
  };
}
