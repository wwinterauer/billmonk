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
  business: { monthly: 14.99, yearly: 143.90 },
};

// Minimum plan required per feature key
export const FEATURE_MIN_PLAN: Record<string, PlanType> = {
  reconciliation: 'starter',
  bankImport: 'starter',
  emailImport: 'starter',
  cloudBackup: 'pro',
  invoiceModule: 'business',
  taxExport: 'business',
};

// Human-readable feature descriptions for upgrade cards
export const FEATURE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  reconciliation: { title: 'Kontoabgleich', description: 'Gleiche deine Belege automatisch mit Banktransaktionen ab.' },
  bankImport: { title: 'Konto-Import & Bank-Schlagwörter', description: 'Importiere Kontoauszüge und erstelle automatische Zuordnungsregeln.' },
  emailImport: { title: 'E-Mail-Import', description: 'Empfange Belege automatisch per E-Mail und verarbeite sie.' },
  cloudBackup: { title: 'Cloud-Backup', description: 'Sichere deine Belege automatisch in der Cloud.' },
  invoiceModule: { title: 'Ausgangsrechnungen', description: 'Erstelle und verwalte Rechnungen, Kunden und Artikel.' },
  taxExport: { title: 'Steuerberater-Export', description: 'Exportiere Buchungsdaten im DATEV- oder BMD-Format für deinen Steuerberater.' },
};

// Plan hierarchy for comparison
const PLAN_ORDER: PlanType[] = ['free', 'starter', 'pro', 'business'];

export function isPlanSufficient(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function getMinPlanForFeature(featureKey: string): PlanType | null {
  return FEATURE_MIN_PLAN[featureKey] || null;
}
