export type PlanType = 'free' | 'starter' | 'pro' | 'business';

export interface PlanLimits {
  receiptsPerMonth: number;
  maxTotal: number | null;
  retentionYears: number | null;
}

export interface PlanFeatures {
  invoiceModule: boolean;
  bankImport: boolean;
  emailImport: boolean;
  cloudBackup: boolean;
  reconciliation: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: { receiptsPerMonth: 10, maxTotal: 100, retentionYears: null },
  starter: { receiptsPerMonth: 30, maxTotal: null, retentionYears: 7 },
  pro: { receiptsPerMonth: 100, maxTotal: null, retentionYears: 10 },
  business: { receiptsPerMonth: 250, maxTotal: null, retentionYears: 10 },
};

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: { invoiceModule: false, bankImport: false, emailImport: false, cloudBackup: false, reconciliation: false },
  starter: { invoiceModule: false, bankImport: true, emailImport: true, cloudBackup: false, reconciliation: true },
  pro: { invoiceModule: false, bankImport: true, emailImport: true, cloudBackup: true, reconciliation: true },
  business: { invoiceModule: true, bankImport: true, emailImport: true, cloudBackup: true, reconciliation: true },
};

export const PLAN_NAMES: Record<PlanType, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

export const PLAN_PRICES: Record<PlanType, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 1.99, yearly: 19.90 },
  pro: { monthly: 4.99, yearly: 47.90 },
  business: { monthly: 9.99, yearly: 95.90 },
};
