// Types for the AI Learning System

export interface VendorLearning {
  id: string;
  user_id: string;
  vendor_id: string;
  is_active: boolean;
  learning_level: number;
  total_corrections: number;
  successful_predictions: number;
  confidence_boost: number;
  field_patterns: Record<string, FieldPattern>;
  layout_hints: Record<string, LayoutHint>;
  last_correction_at: string | null;
  last_successful_at: string | null;
  created_at: string;
  updated_at: string;
  // VAT learning fields
  default_vat_rate?: number | null;
  vat_rate_confidence?: number;
  vat_rate_corrections?: number;
}

export interface FieldPattern {
  prefixes: string[];
  suffixes: string[];
  regex_patterns: string[];
  common_mistakes: Array<{
    detected: string;
    correct: string;
    count: number;
  }>;
  typical_range?: {
    min: number;
    max: number;
  };
  decimal_format?: 'comma' | 'point';
  confidence: number;
}

export interface LayoutHint {
  position?: string;
  near_text?: string;
  format?: string;
  notes?: string;
}

export interface FieldCorrection {
  id: string;
  user_id: string;
  vendor_learning_id: string;
  receipt_id: string | null;
  field_name: string;
  detected_value: string | null;
  corrected_value: string;
  surrounding_text: string | null;
  was_helpful: boolean | null;
  created_at: string;
}

// Learning Levels
export const LEARNING_LEVELS = {
  0: { name: 'Neu', icon: 'Circle', color: 'gray', minCorrections: 0, confidenceBoost: 0 },
  1: { name: 'Lernend', icon: 'Loader2', color: 'yellow', minCorrections: 2, confidenceBoost: 5 },
  2: { name: 'Trainiert', icon: 'CheckCircle', color: 'blue', minCorrections: 5, confidenceBoost: 10 },
  3: { name: 'Zuverlässig', icon: 'Award', color: 'green', minCorrections: 10, confidenceBoost: 15 }
} as const;

export type LearningLevel = keyof typeof LEARNING_LEVELS;

// Fields that can be learned (reference from existing REANALYZABLE_FIELDS)
export const LEARNABLE_FIELDS = [
  { id: 'vendor', label: 'Lieferant', type: 'text' },
  { id: 'invoice_number', label: 'Rechnungsnummer', type: 'text' },
  { id: 'receipt_date', label: 'Datum', type: 'date' },
  { id: 'amount_gross', label: 'Bruttobetrag', type: 'currency' },
  { id: 'amount_net', label: 'Nettobetrag', type: 'currency' },
  { id: 'vat_amount', label: 'MwSt-Betrag', type: 'currency' },
  { id: 'vat_rate', label: 'MwSt-Satz', type: 'percent' },
  { id: 'description', label: 'Beschreibung', type: 'text' },
  { id: 'category', label: 'Kategorie', type: 'text' }
] as const;

export type LearnableFieldId = typeof LEARNABLE_FIELDS[number]['id'];
