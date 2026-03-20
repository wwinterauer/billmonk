export type PlanType = 'free' | 'starter' | 'pro' | 'business';

export interface PlanLimits {
  receiptsPerMonth: number;
  documentsPerMonth: number;
  maxTotal: number | null;
  retentionYears: number | null;
  maxBankConnections: number;
}

export interface PlanFeatures {
  invoiceModule: boolean;
  bankImport: boolean;
  emailImport: boolean;
  cloudBackup: boolean;
  reconciliation: boolean;
  liveBankConnection: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: { receiptsPerMonth: 10, documentsPerMonth: 0, maxTotal: 100, retentionYears: null, maxBankConnections: 0 },
  starter: { receiptsPerMonth: 30, documentsPerMonth: 0, maxTotal: null, retentionYears: 7, maxBankConnections: 0 },
  pro: { receiptsPerMonth: 100, documentsPerMonth: 0, maxTotal: null, retentionYears: 10, maxBankConnections: 1 },
  business: { receiptsPerMonth: 250, documentsPerMonth: 250, maxTotal: null, retentionYears: 10, maxBankConnections: 3 },
};

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: { invoiceModule: false, bankImport: false, emailImport: false, cloudBackup: false, reconciliation: false, liveBankConnection: false },
  starter: { invoiceModule: false, bankImport: true, emailImport: true, cloudBackup: false, reconciliation: true, liveBankConnection: false },
  pro: { invoiceModule: false, bankImport: true, emailImport: true, cloudBackup: true, reconciliation: true, liveBankConnection: true },
  business: { invoiceModule: true, bankImport: true, emailImport: true, cloudBackup: true, reconciliation: true, liveBankConnection: true },
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
  pro: { monthly: 5.99, yearly: 57.50 },
  business: { monthly: 15.99, yearly: 153.50 },
};

// Minimum plan required per feature key
export const FEATURE_MIN_PLAN: Record<string, PlanType> = {
  reconciliation: 'starter',
  bankImport: 'starter',
  emailImport: 'starter',
  cloudBackup: 'pro',
  invoiceModule: 'business',
  taxExport: 'business',
  liveBankConnection: 'pro',
};

// Human-readable feature descriptions for upgrade cards
export const FEATURE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  reconciliation: { title: 'Kontoabgleich', description: 'Gleiche deine Belege automatisch mit Banktransaktionen ab.' },
  bankImport: { title: 'Konto-Import & Bank-Schlagwörter', description: 'Importiere Kontoauszüge und erstelle automatische Zuordnungsregeln.' },
  emailImport: { title: 'E-Mail-Import', description: 'Empfange Belege automatisch per E-Mail und verarbeite sie.' },
  cloudBackup: { title: 'Cloud-Backup', description: 'Sichere deine Belege automatisch in der Cloud.' },
  invoiceModule: { title: 'Ausgangsrechnungen', description: 'Erstelle und verwalte Rechnungen, Kunden und Artikel.' },
  taxExport: { title: 'Steuerberater-Export', description: 'Exportiere Buchungsdaten im DATEV- oder BMD-Format für deinen Steuerberater.' },
  liveBankConnection: { title: 'Live-Bankanbindung', description: 'Verbinde dein Bankkonto direkt und gleiche Ein- & Ausgangsrechnungen automatisch ab.' },
};

// Plan hierarchy for comparison
const PLAN_ORDER: PlanType[] = ['free', 'starter', 'pro', 'business'];

export function isPlanSufficient(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function getMinPlanForFeature(featureKey: string): PlanType | null {
  return FEATURE_MIN_PLAN[featureKey] || null;
}
