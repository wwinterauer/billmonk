import { supabase } from "@/integrations/supabase/client";
import { 
  processDescription, 
  validateDescriptionSettings, 
  DEFAULT_DESCRIPTION_SETTINGS,
  type DescriptionSettings 
} from "@/lib/descriptionUtils";

export interface ExtractionResult {
  vendor: string | null;
  vendor_brand: string | null;
  description: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  receipt_date: string | null;
  category: string | null;
  payment_method: string | null;
  invoice_number: string | null;
  confidence: number;
  raw_response?: string;
}

export interface ExtractionResponse {
  success: boolean;
  data?: ExtractionResult;
  error?: string;
  raw?: string;
}

// Re-export for convenience
export type { DescriptionSettings };
export { processDescription, validateDescriptionSettings, DEFAULT_DESCRIPTION_SETTINGS };

/**
 * Converts a File to a base64 string (without the data URL prefix)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Extracts receipt data from an image file using AI
 * @param file - The image or PDF file to analyze
 * @returns Extracted receipt data
 */
export async function extractReceiptData(file: File): Promise<ExtractionResult> {
  // Validate file type
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!validTypes.includes(file.type)) {
    throw new Error(`Ungültiger Dateityp: ${file.type}. Erlaubt sind: JPG, PNG, WebP, GIF, PDF`);
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("Datei zu groß. Maximale Größe: 10 MB");
  }

  try {
    // Convert file to base64
    const imageBase64 = await fileToBase64(file);

    // Call the edge function
    const { data, error } = await supabase.functions.invoke<ExtractionResponse>("extract-receipt", {
      body: {
        imageBase64,
        mimeType: file.type,
      },
    });

    if (error) {
      console.error("Edge function error:", error);
      throw new Error(error.message || "Fehler bei der KI-Verarbeitung");
    }

    if (!data) {
      throw new Error("Keine Antwort vom KI-Service");
    }

    if (!data.success) {
      throw new Error(data.error || "KI-Extraktion fehlgeschlagen");
    }

    if (!data.data) {
      throw new Error("Keine Daten in der KI-Antwort");
    }

    return {
      ...data.data,
      raw_response: data.raw,
    };
  } catch (error) {
    console.error("Receipt extraction failed:", error);
    throw error;
  }
}

/**
 * Creates default extraction result for manual entry
 */
export function createEmptyExtractionResult(): ExtractionResult {
  return {
    vendor: null,
    vendor_brand: null,
    description: null,
    amount_gross: null,
    amount_net: null,
    vat_amount: null,
    vat_rate: null,
    receipt_date: null,
    category: null,
    payment_method: null,
    invoice_number: null,
    confidence: 0,
  };
}

/**
 * Validates and normalizes extracted data
 * @param result - The extraction result from AI
 * @param descriptionSettings - Optional user settings for description processing
 */
export function normalizeExtractionResult(
  result: ExtractionResult, 
  descriptionSettings?: DescriptionSettings
): ExtractionResult {
  const normalized = { ...result };

  // Ensure amounts are numbers or null
  if (normalized.amount_gross !== null) {
    normalized.amount_gross = Number(normalized.amount_gross) || null;
  }
  if (normalized.amount_net !== null) {
    normalized.amount_net = Number(normalized.amount_net) || null;
  }
  if (normalized.vat_amount !== null) {
    normalized.vat_amount = Number(normalized.vat_amount) || null;
  }
  if (normalized.vat_rate !== null) {
    normalized.vat_rate = Number(normalized.vat_rate) || null;
  }

  // Calculate missing values if possible
  if (normalized.amount_gross && normalized.vat_rate && !normalized.amount_net) {
    normalized.amount_net = normalized.amount_gross / (1 + normalized.vat_rate / 100);
    normalized.vat_amount = normalized.amount_gross - normalized.amount_net;
  }

  // Ensure confidence is between 0 and 1
  if (normalized.confidence !== null) {
    normalized.confidence = Math.max(0, Math.min(1, Number(normalized.confidence) || 0));
  }

  // Validate date format
  if (normalized.receipt_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalized.receipt_date)) {
      normalized.receipt_date = null;
    }
  }

  // Process description with user settings or defaults
  const settings = descriptionSettings || DEFAULT_DESCRIPTION_SETTINGS;
  normalized.description = processDescription(normalized.description, settings);

  return normalized;
}

/**
 * Fetches description settings for a user
 */
export async function fetchDescriptionSettings(userId: string): Promise<DescriptionSettings> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('description_settings')
      .eq('id', userId)
      .single();
    
    if (profile?.description_settings) {
      return validateDescriptionSettings(profile.description_settings);
    }
  } catch (error) {
    console.warn('Could not fetch description settings, using defaults:', error);
  }
  
  return DEFAULT_DESCRIPTION_SETTINGS;
}

/**
 * Gets a confidence label for display
 */
export function getConfidenceLabel(confidence: number): {
  label: string;
  color: "default" | "secondary" | "destructive" | "outline";
} {
  if (confidence >= 0.9) {
    return { label: "Sehr sicher", color: "default" };
  } else if (confidence >= 0.7) {
    return { label: "Sicher", color: "secondary" };
  } else if (confidence >= 0.5) {
    return { label: "Unsicher", color: "outline" };
  } else {
    return { label: "Sehr unsicher", color: "destructive" };
  }
}
