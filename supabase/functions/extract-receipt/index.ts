import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uint8ArrayToBase64 } from "../_shared/base64.ts";
import { hasLegalForm, normalizeVendorName, matchVendor, combineVendorWithLegalForm } from "../_shared/vendorMatch.ts";
import {
  normalizeInvoiceNumber,
  invoiceNumbersMatch,
  amountWithinTolerance,
  amountsEqual,
  dateWithinTolerance,
  daysBetween,
  classifyDocumentKind,
  vendorsLikelySame,
} from "../_shared/duplicateRules.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaxRateDetail {
  rate: number;
  net_amount: number;
  tax_amount: number;
  description?: string;
}

interface ExtractionResult {
  is_receipt: boolean;
  document_type?: string;
  reason?: string;
  vendor: string | null;
  vendor_brand: string | null;
  description: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  is_mixed_tax_rate?: boolean;
  tax_rate_details?: TaxRateDetail[] | null;
  receipt_date: string | null;
  category: string | null;
  tax_type: string | null;
  payment_method: string | null; // deprecated - no longer AI-extracted
  invoice_number: string | null;
  confidence: number;
  vendor_country?: string | null;
  vat_confidence?: number | null;
  vat_detection_method?: 'explicit' | 'calculated' | 'learned' | 'estimated' | 'line_items' | 'totals_line' | 'totals_line_conflict' | null;
  special_vat_case?: 'kleinunternehmer' | 'reverse_charge' | 'ig_lieferung' | 'export' | null;
}

interface MultiInvoiceResult {
  contains_multiple_invoices: boolean;
  confidence: number;
  invoice_count: number;
  invoices: Array<{
    pages: number[];
    vendor_name?: string;
    invoice_number?: string;
    total_amount?: number;
    date?: string;
  }>;
  reason?: string;
}

// ── Structured Output Schema (V2) ──────────────────────────────────
const extractionSchema = {
  type: "object" as const,
  properties: {
    is_financial_document: { type: "boolean" as const },
    document_type: { type: "string" as const },
    reason: { type: "string" as const },
    vendor_name: { type: "string" as const },
    vendor_brand: { type: "string" as const },
    vendor_address: { type: "string" as const },
    vendor_uid: { type: "string" as const },
    vendor_legal_form: { type: "string" as const },
    vendor_country: { type: "string" as const },
    receipt_date: { type: "string" as const },
    due_date: { type: "string" as const },
    receipt_number: { type: "string" as const },
    total_amount: { type: "number" as const },
    net_amount: { type: "number" as const },
    tax_amount: { type: "number" as const },
    total_amount_label: { type: "string" as const },
    net_amount_label: { type: "string" as const },
    tax_amount_label: { type: "string" as const },
    totals_block: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          amount: { type: "number" as const },
        },
        required: ["label", "amount"],
        additionalProperties: false,
      },
    },
    tax_rate: { type: "string" as const },
    line_items_are_net: { type: "boolean" as const },

    is_mixed_tax_rate: { type: "boolean" as const },
    tax_rate_details: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          rate: { type: "number" as const },
          net_amount: { type: "number" as const },
          tax_amount: { type: "number" as const },
          description: { type: "string" as const },
        },
        required: ["rate", "net_amount", "tax_amount", "description"],
        additionalProperties: false,
      },
    },
    currency: { type: "string" as const },
    // payment_method removed from schema - not AI-extractable
    category: { type: "string" as const },
    tax_type: { type: "string" as const },
    description: { type: "string" as const },
    line_items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          description: { type: "string" as const },
          quantity: { type: "number" as const },
          unit_price: { type: "number" as const },
          total: { type: "number" as const },
           net_total: { type: "number" as const },
           tax_amount: { type: "number" as const },
           gross_total: { type: "number" as const },
          tax_rate: { type: "string" as const },
          category: { type: "string" as const },
        },
         required: ["description", "quantity", "unit_price", "total", "net_total", "tax_amount", "gross_total", "tax_rate", "category"],
        additionalProperties: false,
      },
    },
    confidence: { type: "number" as const },
    vat_confidence: { type: "number" as const },
    vat_detection_method: { type: "string" as const },
    special_vat_case: { type: "string" as const },
    notes: { type: "string" as const },
  },
  required: [
    "is_financial_document", "document_type", "vendor_name", "total_amount",
    "tax_rate", "currency", "confidence",
    "reason", "vendor_brand", "vendor_address", "vendor_uid",
    "vendor_legal_form", "vendor_country", "receipt_date", "due_date",
    "receipt_number", "net_amount", "tax_amount", "is_mixed_tax_rate", "line_items_are_net",
    "tax_rate_details", "description", "line_items",
    "vat_confidence", "vat_detection_method", "special_vat_case", "notes",
    "category", "tax_type",
    "total_amount_label", "net_amount_label", "tax_amount_label", "totals_block",

  ],
  additionalProperties: false,
};

// Vendor name helpers live in _shared/vendorMatch.ts so extraction and the
// retroactive reconcile function use identical matching rules.
// (imported at the top of this file)


// ── Map structured output → internal ExtractionResult ──────────────
function mapSchemaToResult(raw: Record<string, any>): ExtractionResult {
  const taxRateStr = raw.tax_rate || "";
  let vatRate: number | null = null;
  if (taxRateStr && taxRateStr !== "unknown" && taxRateStr !== "") {
    const parsed = parseFloat(taxRateStr);
    if (!isNaN(parsed)) vatRate = parsed;
  }

  // Combine vendor_name + vendor_legal_form when AI returned them separately
  const combinedVendor = combineVendorWithLegalForm(raw.vendor_name, raw.vendor_legal_form);

  return {
    is_receipt: raw.is_financial_document === true,
    document_type: raw.document_type || undefined,
    reason: raw.reason || undefined,
    vendor: combinedVendor,
    vendor_brand: raw.vendor_brand || null,
    description: raw.description || null,
    amount_gross: raw.total_amount ?? null,
    amount_net: raw.net_amount ?? null,
    vat_amount: raw.tax_amount ?? null,
    vat_rate: vatRate,
    is_mixed_tax_rate: raw.is_mixed_tax_rate || false,
    tax_rate_details: raw.tax_rate_details && raw.tax_rate_details.length > 0
      ? raw.tax_rate_details : null,
    receipt_date: raw.receipt_date || null,
    category: raw.category || null,
    tax_type: raw.tax_type || null,
    payment_method: null, // no longer AI-extracted
    invoice_number: raw.receipt_number || null,
    confidence: raw.confidence || 0,
    vendor_country: raw.vendor_country || null,
    vat_confidence: raw.vat_confidence || null,
    vat_detection_method: raw.vat_detection_method || null,
    special_vat_case: raw.special_vat_case || null,
  };
}

// ── Category hints builder ─────────────────────────────────────────
function buildCategoryHints(country: string | null, categories: string[]): string {
  if (!country || categories.length === 0) return '';

  const has = (name: string) => categories.some(c => c.toLowerCase().includes(name.toLowerCase()));

  let hints = `

ZUORDNUNGSHILFE (länderspezifisch, betrifft NUR tax_type bzw. die obige Liste – KEINE category-Werte erfinden):`;

  if (country === 'AT') {
    hints += `
AT-spezifisch:${has('Bewirtung') ? ' Bewirtung 50% absetzbar.' : ''}${has('Reisekosten') ? ' Tagesdiäten 26,40€.' : ''}${has('KFZ') ? ' Km-Geld 0,42€/km.' : ''}${has('Geringwertig') ? ' GWG-Grenze 1.000€ netto.' : ''}`;
  } else if (country === 'DE') {
    hints += `
DE-spezifisch:${has('Bewirtung') ? ' Bewirtung 70% absetzbar.' : ''}${has('Reisekosten') ? ' Verpflegungspauschale 28€/>24h, 14€/>8h.' : ''}${has('KFZ') ? ' Pendlerpauschale 0,30€/km.' : ''}${has('Geringwertig') ? ' GWG 800€ netto. Computer sofort absetzbar.' : ''}`;
  } else if (country === 'CH') {
    hints += `
CH-spezifisch:${has('KFZ') ? ' Km-Pauschale 0,70 CHF/km.' : ''}${has('Geringwertig') ? ' GWG 1.000 CHF.' : ''}`;
  }

  return hints;
}

// ── Tax-Type-Liste pro Land (Quelle: src/components/settings/taxCategoryInfo.ts) ────
const TAX_TYPES_BY_COUNTRY: Record<string, string[]> = {
  AT: [
    "Bewirtung 50% (AT)", "Reisekosten (AT)", "KFZ-Kosten (AT)", "Büromaterial (AT)",
    "Telefon & Internet (AT)", "Versicherungen (AT)", "Miete & Betriebskosten (AT)",
    "Fortbildung (AT)", "Werbung & Marketing (AT)", "Rechts-/Beratungskosten (AT)",
    "Bankgebühren (AT)", "Geringwertige WG (AT)", "Abschreibungen AfA (AT)",
    "Sozialversicherung SVS (AT)", "Kammerumlage WKO (AT)",
  ],
  DE: [
    "Bewirtung 70% (DE)", "Reisekosten (DE)", "KFZ-Kosten (DE)", "Bürobedarf (DE)",
    "Telekommunikation (DE)", "Versicherungen (DE)", "Raumkosten/Miete (DE)",
    "Fortbildungskosten (DE)", "Werbekosten (DE)", "Rechts-/Beratungskosten (DE)",
    "Geringwertige WG (DE)", "Abschreibungen AfA (DE)", "Leasingkosten (DE)",
    "Geschenke §4 Abs.5 (DE)", "IHK-Beiträge (DE)",
  ],
  CH: [
    "Geschäftsbewirtung (CH)", "Reisekosten (CH)", "Fahrzeugkosten (CH)", "Büromaterial (CH)",
    "Telekommunikation (CH)", "Versicherungsprämien (CH)", "Mietaufwand (CH)",
    "Weiterbildung (CH)", "Werbeaufwand (CH)", "Beratungskosten (CH)",
    "Abschreibungen (CH)", "AHV/IV/EO-Beiträge (CH)", "BVG-Beiträge (CH)",
  ],
};

function buildTaxTypeList(country: string | null): string {
  const list = TAX_TYPES_BY_COUNTRY[(country || 'AT').toUpperCase()] || [];
  return list.join(', ');
}

// Validates a tax_type against the allowed list for the country.
// Returns the value if valid, or null if hallucinated/unknown.
function validateTaxType(value: string | null | undefined, country: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const countryList = TAX_TYPES_BY_COUNTRY[(country || 'AT').toUpperCase()] || [];
  if (countryList.includes(trimmed)) return trimmed;
  // Allow values from any country list (in case vendor_country was misdetected)
  const allKnown = new Set(Object.values(TAX_TYPES_BY_COUNTRY).flat());
  if (allKnown.has(trimmed)) return trimmed;
  console.log(`[Tax Type Validation] Rejecting hallucinated tax_type "${trimmed}" (country: ${country || 'AT'})`);
  return null;
}

// ── Expenses-only prompt builder (deduplicated) ────────────────────
function buildExpensesOnlyPrompt(keywords: string[], hint: string): string {
  let prompt = '';

  if (keywords.length > 0) {
    prompt = `

WICHTIG – NUR AUSGABEN EXTRAHIEREN:
Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten.
Extrahiere AUSSCHLIESSLICH die Positionen, die eines dieser Schlagwörter enthalten: ${keywords.join(", ")}
Ignoriere alle anderen Zeilen (Einnahmen, Gutschriften, Auszahlungen).

STRENGE FILTERREGEL:
- Eine Zeile wird NUR erfasst, wenn ihr Text eines der obigen Schlagwörter wörtlich enthält
- Wenn eine Zeile KEINES dieser Schlagwörter enthält → KOMPLETT IGNORIEREN
- Es zählen NUR exakte Treffer — keine Synonyme
- Durchsuche ALLE Seiten des Dokuments, nicht nur die erste
- Ein Schlagwort kann MEHRFACH vorkommen → jede Zeile einzeln erfassen
- Jede Zeile genau EINMAL zählen, NICHT Summen-/Zwischensummenzeilen
- Beträge in Klammern, mit Minus oder in einer Abzugsspalte sind bei diesen Schlagwort-Zeilen ebenfalls AUSGABEN → immer POSITIV erfassen
- Gutschriften/Erstattungen ohne Schlagwort ignorieren
- Jede gefundene Zeile hat eigene Spalten für Netto, USt und Betrag: net_total = Wert aus „Netto“, tax_amount = Wert aus „USt./MwSt.“, gross_total = Wert aus „Betrag“. total MUSS identisch mit gross_total sein.
- „Betrag“ ist hier der tatsächlich belastete BRUTTOBETRAG und darf NIEMALS als Netto interpretiert oder nochmals um USt. erhöht werden.
- total_amount = Summe der gross_total-/„Betrag“-Werte ALLER gefundenen Schlagwort-Zeilen (positiv). amount_net = Summe der net_total-Werte, tax_amount = Summe der USt.-Werte. Beispiel Brutto: 0,14 + 12,00 + 1,87 = 14,01
- Die Summenzeilen des Dokuments (Gesamtbetrag, Auszahlung, Saldo) gelten NICHT für diesen Beleg: total_amount_label, net_amount_label, tax_amount_label und totals_block MÜSSEN null bzw. leer bleiben

description: Gefundene Positionen mit Beträgen auflisten, z.B.: "Transaktionsgebühr 3,50€; Betreiber-Abonnement 12,00€"`;
  } else {
    prompt = `

NUR AUSGABEN EXTRAHIEREN:
Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten.
Extrahiere NUR Kosten-Positionen (Gebühren, Abos, Transaktionskosten).
Einnahmen/Erlöse/Gutschriften/Auszahlungen IGNORIEREN.
Ignoriere Zwischen- und Gesamtsummen — nur einzelne Kostenzeilen zählen.
Summiere alle gefundenen Kosten-Positionen zum Gesamtbetrag.
Alle Beträge POSITIV.`;
  }

  if (hint) {
    prompt += `

LIEFERANTEN-HINWEIS: ${hint}`;
  }

  return prompt;
}

// ── Multi-invoice check prompt ─────────────────────────────────────
const multiInvoiceCheckPrompt = `Analysiere dieses Dokument sorgfältig.

AUFGABE: Prüfe ob dieses PDF MEHRERE separate Rechnungen/Belege enthält.

Anzeichen für MEHRERE Rechnungen:
- Verschiedene Rechnungsnummern im Dokument
- Verschiedene Rechnungsdaten
- Verschiedene Absender/Firmen
- Verschiedene Gesamtbeträge mit separaten Summenzeilen
- Klare visuelle Trennung zwischen Dokumenten
- "Seite 1 von X" startet mehrfach neu
- Mehrere separate Briefköpfe

WICHTIG: 
- Ein mehrseitiger Beleg vom GLEICHEN Absender mit EINER Rechnungsnummer ist EINE Rechnung!
- Anhänge oder Detailseiten zur gleichen Rechnung zählen NICHT als separate Rechnung
- Nur wenn VERSCHIEDENE Rechnungsnummern oder VERSCHIEDENE Absender → mehrere Rechnungen

Antworte AUSSCHLIESSLICH im JSON-Format (keine anderen Texte):

Falls MEHRERE Rechnungen erkannt:
{
  "contains_multiple_invoices": true,
  "confidence": 0.85,
  "invoice_count": 3,
  "invoices": [
    {
      "pages": [1, 2],
      "vendor_name": "Amazon EU S.a.r.l.",
      "invoice_number": "123-456-789",
      "total_amount": 49.99,
      "date": "2025-01-15"
    }
  ],
  "reason": "3 verschiedene Absender mit separaten Rechnungsnummern erkannt"
}

Falls nur EINE Rechnung (auch wenn mehrseitig):
{
  "contains_multiple_invoices": false,
  "confidence": 0.95,
  "invoice_count": 1,
  "invoices": [],
  "reason": "Einzelne mehrseitige Rechnung von [Vendor] mit einer Rechnungsnummer"
}`;

// ── PDF page count estimator ───────────────────────────────────────
function estimatePdfPageCount(pdfBytes: Uint8Array): number {
  try {
    const text = new TextDecoder('latin1').decode(pdfBytes);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) return pageMatches.length;
    return Math.max(1, Math.ceil(pdfBytes.length / 50000));
  } catch {
    return 1;
  }
}

// ── Multi-invoice checker ──────────────────────────────────────────
async function checkForMultipleInvoices(
  pdfBase64: string,
  mimeType: string,
  pageCount: number,
  apiKey: string
): Promise<MultiInvoiceResult> {
  if (pageCount <= 1) {
    return { contains_multiple_invoices: false, confidence: 1.0, invoice_count: 1, invoices: [], reason: "Einzelseiten-PDF" };
  }

  try {
    console.log(`Checking ${pageCount}-page PDF for multiple invoices...`);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du analysierst PDFs auf mehrere Rechnungen. Antworte nur mit JSON." },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${pdfBase64}` } },
              { type: "text", text: multiInvoiceCheckPrompt },
            ],
          },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Multi-invoice check failed:', response.status);
      return { contains_multiple_invoices: false, confidence: 0, invoice_count: 1, invoices: [] };
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '{}';
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) cleanedContent = cleanedContent.slice(7);
    else if (cleanedContent.startsWith("```")) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith("```")) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();

    const parsed: MultiInvoiceResult = JSON.parse(cleanedContent);
    console.log('Multi-invoice check result:', {
      contains_multiple: parsed.contains_multiple_invoices,
      count: parsed.invoice_count,
      confidence: parsed.confidence,
    });
    return parsed;
  } catch (error) {
    console.error('Multi-invoice check error:', error);
    return { contains_multiple_invoices: false, confidence: 0, invoice_count: 1, invoices: [] };
  }
}

// ════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    let imageBase64: string;
    let mimeType: string;
    let receiptId: string | null = null;
    let receipt: Record<string, any> | null = null; // Consolidated receipt data
    const forceExtract = body.forceExtract === true;
    const skipMultiCheck = body.skipMultiCheck === true;
    const forceTreatAsReceipt = body.forceTreatAsReceipt === true;
    const expensesOnly = body.expensesOnly === true;
    const extractionKeywords: string[] = Array.isArray(body.extractionKeywords) ? body.extractionKeywords : [];
    const extractionHint: string = typeof body.extractionHint === 'string' ? body.extractionHint.trim() : '';

    // ── Receipt-by-ID path ─────────────────────────────────────────
    if (body.receiptId) {
      receiptId = body.receiptId;
      console.log(`Processing receipt by ID: ${receiptId}${forceExtract ? ' (forced)' : ''}${skipMultiCheck ? ' (skip multi-check)' : ''}`);

      // Single consolidated query for receipt data
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (receiptError || !receiptData) {
        console.error("Receipt not found:", receiptError);
        return new Response(
          JSON.stringify({ success: false, error: "The requested receipt could not be found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      receipt = receiptData;

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('receipts')
        .download(receipt.file_url);

      if (downloadError || !fileData) {
        console.error("Failed to download file:", downloadError);
        return new Response(
          JSON.stringify({ success: false, error: "File could not be retrieved. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      imageBase64 = uint8ArrayToBase64(fileBytes);
      mimeType = receipt.file_type === 'pdf' ? 'application/pdf' : `image/${receipt.file_type}`;

      const isPdf = receipt.file_name?.endsWith('.pdf') || receipt.file_type === 'application/pdf' || receipt.file_type === 'pdf';
      if (isPdf) mimeType = 'application/pdf';
      console.log(`Downloaded file: ${receipt.file_name}, type: ${mimeType}`);

      // Page count for PDFs
      let pageCount = 1;
      if (isPdf) {
        pageCount = estimatePdfPageCount(fileBytes);
        console.log(`Estimated PDF page count: ${pageCount}`);
        await supabase.from('receipts').update({ page_count: pageCount }).eq('id', receiptId);
      }

      // Multi-Invoice Check
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!skipMultiCheck && isPdf && pageCount > 1 && LOVABLE_API_KEY) {
        const multiCheck = await checkForMultipleInvoices(imageBase64, mimeType, pageCount, LOVABLE_API_KEY);
        if (multiCheck.contains_multiple_invoices && multiCheck.confidence >= 0.7 && multiCheck.invoice_count >= 2) {
          console.log(`Multiple invoices detected: ${multiCheck.invoice_count} — saving suggestion, continuing extraction so user has data in Review`);
          // Save split suggestion but DO NOT block extraction. Receipt will land in Review,
          // where MultiInvoiceAlert (triggered by split_suggestion) lets the user split or keep as one.
          await supabase.from('receipts').update({
            split_suggestion: multiCheck,
            notes: `${multiCheck.invoice_count} separate Rechnungen erkannt. In der Review aufteilen oder als einzelne Rechnung behalten.`,
          }).eq('id', receiptId);
        }
      }

    } else if (body.imageBase64 && body.mimeType) {
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Missing receiptId or imageBase64/mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Lovable AI Gateway for receipt extraction (V2 prompt)...");

    // ── V2 compressed system prompt ────────────────────────────────
    const systemPrompt = "Dokumentenanalyse-Experte. Prüfe ob Finanzbeleg. Antworte NUR mit validem JSON, kein Markdown.";

    // ── Build expenses-only prompt if needed ───────────────────────
    let expensesOnlyPrompt = '';
    let vendorData: Record<string, any> | null = null;

    // Consolidated vendor lookup (single query)
    if (receipt?.vendor_id) {
      const { data: vd } = await supabase
        .from('vendors')
        .select('expenses_only_extraction, extraction_keywords, extraction_hint, display_name, legal_names, default_category_id')
        .eq('id', receipt.vendor_id)
        .single();
      vendorData = vd;
    }

    if (receipt?.vendor_id && !expensesOnly && vendorData?.expenses_only_extraction) {
      const vendorKeywords: string[] = vendorData.extraction_keywords || [];
      const allKeywords = [...new Set([...extractionKeywords, ...vendorKeywords])];
      const hint = extractionHint || vendorData.extraction_hint || '';
      expensesOnlyPrompt = buildExpensesOnlyPrompt(allKeywords, hint);
    } else if (expensesOnly) {
      const allKeywords = [...new Set([...extractionKeywords])];
      const hint = extractionHint || (vendorData?.extraction_hint || '');
      expensesOnlyPrompt = buildExpensesOnlyPrompt(allKeywords, hint);
    }

    // Build extraction hint (if not already included in expensesOnlyPrompt)
    let extractionHintPrompt = '';
    if (!expensesOnlyPrompt && extractionHint) {
      extractionHintPrompt = `\nLIEFERANTEN-HINWEIS: ${extractionHint}`;
    } else if (!expensesOnlyPrompt && !extractionHint && vendorData?.extraction_hint) {
      extractionHintPrompt = `\nLIEFERANTEN-HINWEIS: ${vendorData.extraction_hint}`;
    }

    console.log(`Expenses-only mode: ${expensesOnlyPrompt ? 'ACTIVE' : 'inactive'} (flag: ${expensesOnly}, keywords: ${extractionKeywords.length})`);

    // ── Fetch categories ───────────────────────────────────────────
    let categoryList = '(keine eigenen Kategorien definiert)';
    let userCategoryNames: string[] = [];
    let userCountry: string | null = null;
    let userId: string | null = receipt?.user_id || null;
    if (!userId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
      }
    }

    if (userId) {
      const { data: userProfile } = await supabase.from('profiles').select('country').eq('id', userId).single();
      userCountry = userProfile?.country?.toUpperCase() || null;

      // category-Liste = NUR persönliche User-Kategorien + globale System-Einträge ohne Land.
      // Steuer-Buchungsarten (KFZ-Kosten (AT) etc.) gehen NICHT mehr hier rein, sondern in tax_type.
      const { data: userCategories } = await supabase
        .from('categories')
        .select('name, country')
        .eq('is_hidden', false)
        .or(`user_id.eq.${userId},and(is_system.eq.true,country.is.null)`)
        .order('sort_order');

      if (userCategories && userCategories.length > 0) {
        const catNames = userCategories.map(c => c.name).filter(n => n !== 'Keine Rechnung');
        userCategoryNames = catNames;
        if (catNames.length > 0) {
          categoryList = catNames.join(', ');

          // Community patterns (limited to 15) — gelten nur für User-Kategorien
          const { data: communityPatterns } = await supabase
            .from('community_patterns')
            .select('vendor_name_normalized, suggested_category, contributor_count')
            .eq('is_verified', true)
            .eq('country', userCountry || '')
            .order('contributor_count', { ascending: false })
            .limit(15);

          if (communityPatterns && communityPatterns.length > 0) {
            const communityHints = communityPatterns
              .filter(cp => catNames.some(cn => cn.toLowerCase() === cp.suggested_category.toLowerCase()))
              .map(cp => `- "${cp.vendor_name_normalized}" → ${cp.suggested_category}`)
              .join('\n');
            if (communityHints) {
              categoryList += `\n\nVERIFIZIERTE ZUORDNUNGEN (User-Kategorien):\n${communityHints}`;
            }
          }

          console.log(`Using ${catNames.length} user categories (country: ${userCountry}, community: ${communityPatterns?.length || 0})`);
        }
      }
    }

    // Buchungsarten-Liste (steuerliche Einordnung) – NICHT mehr in categories-Tabelle.
    const taxTypeList = buildTaxTypeList(userCountry);
    const taxTypeHints = buildCategoryHints(userCountry, TAX_TYPES_BY_COUNTRY[(userCountry || 'AT').toUpperCase()] || []);

    // ── V2 compressed user prompt ──────────────────────────────────
    const userPrompt = `Analysiere dieses Dokument:

SCHRITT 1: Ist dies ein Finanzbeleg (Rechnung, Quittung, Kassenbon, Gutschrift)?
Wenn NEIN: is_financial_document=false, document_type angeben, reason ausfüllen. Restliche Felder leer/""/0.

SCHRITT 2: Beleg-Daten extrahieren.

LIEFERANT:
- vendor_name = Offizieller Firmenname IMMER MIT Rechtsform aus Impressum/Fußbereich/AGB-Block. PFLICHT: Suche aktiv im Fußbereich, Impressum und neben der UID-Nr. Wenn dort eine Rechtsform steht (GmbH, AG, KG, OG, e.U., UG, Ltd. etc.), MUSS sie Teil von vendor_name sein – auch wenn im Kopf nur die Marke prangt (z.B. "Sowana" im Kopf, "Sowana Handels GmbH" im Fuß → vendor_name = "Sowana Handels GmbH").
- vendor_legal_form = NUR die Rechtsform separat (z.B. "GmbH", "Handels GmbH", "e.U."), leer wenn keine erkennbar.
- Rechtsform erkennen: GmbH/AG/KG/OG/e.U./EU/UG/Ltd./LLC/Inc./S.à r.l./B.V./S.r.l. etc.
- vendor_brand = Markenname falls abweichend vom Firmennamen (sonst "")
- vendor_country = ISO-2-Code aus UID-Nr (ATU→AT, DE→DE, CHE→CH) oder Adresse
- Bei mehreren Firmen: RECHNUNGSSTELLER nehmen, nicht Empfänger

BESCHREIBUNG: Alle Positionen zusammenfassen, max 100 Zeichen, keine Preise.

KATEGORIE (category, persönliches User-Label – UNABHÄNGIG von Steuerrecht):
STRIKT: Verwende EXAKT einen Namen aus dieser Liste (case-insensitive, zeichengetreu) ODER lasse leer (""). NIEMALS einen Namen erfinden, abwandeln, übersetzen, kombinieren oder ergänzen (z.B. "Software/EDV" statt "Software", "Reisekosten/Hotel" statt "Reisekosten"). Im Zweifel "" zurückgeben. Liste: ${categoryList}
WICHTIG: category ist KEIN Steuer-Begriff. Nimm hier NIE Werte wie "KFZ-Kosten (AT)" oder "Bewirtung 50%" – die gehören ausschließlich in tax_type.

BUCHUNGSART (tax_type, steuerliche Einordnung – UNABHÄNGIG von category):
STRIKT: Wähle EXAKT einen Wert aus dieser Liste ODER lass leer (""). NIEMALS einen anderen Begriff erfinden (z.B. "Betriebsausgabe", "Sonstiges", "Aufwand"). Im Zweifel "" zurückgeben.
Erlaubte Werte: ${taxTypeList}${taxTypeHints}
MwSt-ERKENNUNG:
- Suche explizite %-Angaben auf dem Beleg (20%, 19%, 10%, 7% etc.)
- Berechne: MwSt = Brutto × Satz/(100+Satz). Validiere: Netto + MwSt = Brutto (±0.05€)
- Steuerraten DACH: AT=20/13/10%, DE=19/7%, CH=8.1/2.6/3.8%
- Gemischte Sätze (z.B. Supermarkt): is_mixed_tax_rate=true, tax_rate_details ausfüllen, tax_rate="mixed"
- Einzelner Satz: tax_rate="20" (als String), is_mixed_tax_rate=false
- Wenn nicht erkennbar: tax_rate="unknown"
- 0% ist GÜLTIG bei Kleinunternehmer/Reverse Charge/IG-Lieferung → tax_rate="0", special_vat_case setzen

VAT-KONFIDENZ:
- vat_confidence 0.95-1.0: explizit + Berechnung stimmt
- 0.80-0.94: explizit ODER eindeutig berechenbar
- 0.50-0.79: aus Kontext abgeleitet
- <0.50: geschätzt/nicht gefunden
- vat_detection_method: "explicit"/"calculated"/"estimated"

BETRÄGE: Dezimalzahlen ohne Währungssymbol. 0 wenn nicht erkennbar. Datum: YYYY-MM-DD oder "".
RANGFOLGE (WICHTIGSTE REGEL): Beschriftete Summenzeilen im Summenblock haben IMMER Vorrang vor selbst berechneten Positionssummen. Rechne NIEMALS die Positionen zusammen, wenn eine beschriftete Summenzeile existiert.
- total_amount = IMMER der Endbetrag INKLUSIVE MwSt. aus einer beschrifteten Zeile: "Gesamtbetrag", "Gesamtsumme", "Rechnungsbetrag", "Zu zahlen", "Summe inkl. MwSt.", "Total incl. VAT", "Endbetrag", "Zahlbetrag".
- net_amount = Betrag OHNE MwSt. aus einer beschrifteten Zeile: "Nettobetrag", "Summe netto", "Total EUR ohne MwSt.", "Nettosumme", "Warenwert netto".
- tax_amount = ausgewiesener MwSt-/USt-Betrag ("MwSt.", "USt.", "VAT", "Steuerbetrag").
- total_amount_label / net_amount_label / tax_amount_label = der WÖRTLICHE Text der Zeile, aus der du den jeweiligen Betrag genommen hast (z.B. "Summe EUR inkl. MwSt."). Leer "" nur, wenn keine solche Zeile existiert.
- totals_block = ALLE Zeilen des Summenblocks als Liste {label, amount}, in der Reihenfolge des Belegs. Das ist Pflicht, wenn ein Summenblock existiert.
- WARNUNG: Enthält die Zeile "ohne MwSt.", "exkl.", "netto" oder "zzgl. MwSt.", darf dieser Wert NIEMALS in total_amount stehen.
- Bei mehreren Summenzeilen ist der HÖCHSTE Betrag am Ende des Summenblocks das Brutto.
- Es muss gelten: net_amount + tax_amount = total_amount.
- line_items_are_net = true, wenn die Positionspreise OHNE MwSt. ausgewiesen sind (typisch bei B2B-Rechnungen), sonst false.
receipt_number: Rechnungsnummer suchen (RE-Nr, Invoice, Belegnummer etc.) oder "".

LINE_ITEMS: Jede Rechnungsposition einzeln erfassen mit Kategorie. Keine Summenzeilen.
- Pro Position: net_total = Netto-Zeilenwert, tax_amount = ausgewiesene USt./MwSt., gross_total = Brutto-/„Betrag“-Zeilenwert. total = gross_total. Falls nur ein Betrag vorhanden ist, ordne ihn anhand der Spaltenüberschrift zu; erfinde keine Steuerwerte.
- VOLLSTÄNDIGKEIT: Erfasse ALLE Positionen, auch über mehrere Seiten hinweg. Prüfe zum Schluss selbst: Summe der Positionen muss zum ausgewiesenen Gesamtbetrag passen. Passt sie nicht, hast du Positionen übersehen — suche weiter. Kürze die Liste NIEMALS ab.
- VORZEICHEN: Rabatte, Gutschriften, Stornos und Abzüge werden als NEGATIVE total/unit_price erfasst (z.B. Rabatt -117.75). Niemals positiv angeben.${expensesOnlyPrompt}${extractionHintPrompt}`;



    // ── AI API Call with structured output ─────────────────────────
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: userPrompt },
            ],
          },
        ],
        max_tokens: 8192,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_extraction",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      console.error("AI Gateway returned empty response body");
      return new Response(
        JSON.stringify({ success: false, error: "AI returned empty response. The document may be too large. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr, "Body length:", responseText.length, "First 200 chars:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: "AI response was incomplete. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("AI Response received (V2)");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in AI response:", aiResponse);
      return new Response(
        JSON.stringify({ success: false, error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON (structured output should be clean, but handle edge cases)
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) cleanedContent = cleanedContent.slice(7);
    else if (cleanedContent.startsWith("```")) cleanedContent = cleanedContent.slice(3);
    if (cleanedContent.endsWith("```")) cleanedContent = cleanedContent.slice(0, -3);
    cleanedContent = cleanedContent.trim();

    let rawData: any;
    try {
      rawData = JSON.parse(cleanedContent);
    } catch (jsonErr) {
      console.error("AI JSON invalid:", jsonErr, cleanedContent.slice(0, 500));
      if (receiptId) {
        await supabase.from('receipts').update({
          status: 'review',
          notes: 'KI-Antwort war kein gültiges JSON. Bitte manuell prüfen.',
          ai_processed_at: new Date().toISOString(),
        }).eq('id', receiptId);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const extractedData = mapSchemaToResult(rawData);


      // ── Post-Processing: amounts positive ────────────────────────
      if (extractedData.amount_gross != null && extractedData.amount_gross < 0) {
        console.log(`[Amount Fix] amount_gross ${extractedData.amount_gross} → ${Math.abs(extractedData.amount_gross)}`);
        extractedData.amount_gross = Math.abs(extractedData.amount_gross);
      }
      if (extractedData.amount_net != null && extractedData.amount_net < 0) extractedData.amount_net = Math.abs(extractedData.amount_net);
      if (extractedData.vat_amount != null && extractedData.vat_amount < 0) extractedData.vat_amount = Math.abs(extractedData.vat_amount);
      if (extractedData.tax_rate_details && Array.isArray(extractedData.tax_rate_details)) {
        extractedData.tax_rate_details = extractedData.tax_rate_details.map(d => ({
          ...d, net_amount: Math.abs(d.net_amount), tax_amount: Math.abs(d.tax_amount),
        }));
      }

      // ── Post-Processing: Brutto/Netto-Verwechslung korrigieren ───
      // Häufiger AI-Fehler: die Zeile "Total ohne MwSt." wird als Gesamtbetrag genommen.
      {
        const gross = Number(extractedData.amount_gross);
        const net = Number(extractedData.amount_net);
        const vat = Number(extractedData.vat_amount);
        const rate = Number(extractedData.vat_rate);
        const nearlyEqual = Number.isFinite(gross) && Number.isFinite(net) && net > 0 &&
          Math.abs(gross - net) / Math.max(net, 1) < 0.01;

        if (nearlyEqual && Number.isFinite(vat) && vat > 0) {
          const corrected = Math.round((net + vat) * 100) / 100;
          console.warn(`[Gross Fix] total_amount ${gross} entsprach dem Nettobetrag → Brutto korrigiert auf ${corrected}`);
          extractedData.amount_gross = corrected;
          (extractedData as any).vat_confidence = Math.min(Number((extractedData as any).vat_confidence) || 0.8, 0.7);
        } else if (nearlyEqual && Number.isFinite(rate) && rate > 0) {
          const corrected = Math.round(net * (1 + rate / 100) * 100) / 100;
          console.warn(`[Gross Fix] total_amount ${gross} entsprach dem Nettobetrag → Brutto ${corrected} (${rate}%)`);
          extractedData.amount_gross = corrected;
          extractedData.vat_amount = Math.round((corrected - net) * 100) / 100;
          (extractedData as any).vat_confidence = Math.min(Number((extractedData as any).vat_confidence) || 0.8, 0.7);
        }
      }

      // ── Post-Processing: Summenzeilen-Anker (Labels schlagen Positionssummen) ──
      const GROSS_LABEL_RE = /(gesamtbetrag|gesamtsumme|rechnungsbetrag|zu zahlen|zahlbetrag|endbetrag|endsumme|bruttobetrag|brutto|inkl\.?\s*mwst|incl\.?\s*vat|including vat|total amount|grand total|amount due)/i;
      const NET_LABEL_RE = /(nettobetrag|netto|nettosumme|summe netto|ohne mwst|exkl|excl|zzgl|net amount|subtotal|zwischensumme|warenwert)/i;
      const isGrossLabel = (l: unknown) => typeof l === 'string' && GROSS_LABEL_RE.test(l) && !NET_LABEL_RE.test(l);
      const isNetLabel = (l: unknown) => typeof l === 'string' && NET_LABEL_RE.test(l);

      const totalsBlock: Array<{ label?: string; amount?: number }> =
        Array.isArray(rawData.totals_block) ? rawData.totals_block : [];

      const pickFromBlock = (pred: (l: unknown) => boolean): number | null => {
        const hits = totalsBlock
          .filter(e => pred(e?.label) && Number.isFinite(Number(e?.amount)) && Math.abs(Number(e.amount)) > 0)
          .map(e => Math.abs(Number(e.amount)));
        if (hits.length === 0) return null;
        return Math.max(...hits);
      };

      let anchorGross: number | null = null;
      let anchorNet: number | null = null;
      let anchorLabel = '';

      // Im Ausgaben-Filter-Modus (Sammelabrechnungen) gelten die Dokument-Summen NICHT
      // für diesen Beleg – nur die gefilterten Schlagwort-Positionen zählen.
      const expensesOnlyMode = !!expensesOnlyPrompt;
      if (expensesOnlyMode) {
        console.log('[Totals Anchor] Übersprungen – Ausgaben-Filter-Modus aktiv');
      }

      if (!expensesOnlyMode) {
        if (isGrossLabel(rawData.total_amount_label) && Math.abs(Number(rawData.total_amount)) > 0) {
          anchorGross = Math.abs(Number(rawData.total_amount));
          anchorLabel = String(rawData.total_amount_label);
        } else {
          const fromBlock = pickFromBlock(isGrossLabel);
          if (fromBlock != null) {
            anchorGross = fromBlock;
            anchorLabel = 'totals_block';
          }
        }

        if (isNetLabel(rawData.net_amount_label) && Math.abs(Number(rawData.net_amount)) > 0) {
          anchorNet = Math.abs(Number(rawData.net_amount));
        } else {
          anchorNet = pickFromBlock(isNetLabel);
        }

        // Kein Brutto-Label, aber Netto-Label + ausgewiesene Steuer → Brutto rekonstruieren
        if (anchorGross == null && anchorNet != null && Math.abs(Number(rawData.tax_amount)) > 0) {
          anchorGross = Math.round((anchorNet + Math.abs(Number(rawData.tax_amount))) * 100) / 100;
          anchorLabel = 'netto+steuer';
        }

        if (anchorGross != null) {
          console.log(`[Totals Anchor] Brutto ${anchorGross} aus Summenzeile "${anchorLabel}"`);
          extractedData.amount_gross = anchorGross;
          if (anchorNet != null && anchorNet > 0 && anchorNet <= anchorGross) {
            extractedData.amount_net = anchorNet;
            extractedData.vat_amount = Math.round((anchorGross - anchorNet) * 100) / 100;
          }
        }
      }

      // ── Post-Processing: rebuild tax_rate_details from line_items (truth from granular data) ──
      const lineItems = Array.isArray(rawData.line_items) ? rawData.line_items : [];

      const validLineItems = lineItems.filter((li: any) => {
        const total = Number(expensesOnlyMode ? (li?.gross_total ?? li?.total) : li?.total);
        return li && Number.isFinite(total) && total !== 0 && li.tax_rate != null;
      });

      if (validLineItems.length > 0) {
        const rateGroups: Record<string, { sum: number; descriptions: string[] }> = {};
        let lineItemsSum = 0;
        // Vorzeichen bleiben erhalten: Rabatte/Gutschriften werden abgezogen, nicht addiert.
        // Ausnahme: im Ausgaben-Filter-Modus sind auch Klammer-/Minus-Beträge Ausgaben → Betrag positiv.
        for (const li of validLineItems) {
          const rateKey = String(parseFloat(String(li.tax_rate).replace(',', '.').replace('%', '')) || 0);
          if (!rateGroups[rateKey]) rateGroups[rateKey] = { sum: 0, descriptions: [] };
          // Bei Sammelabrechnungen ist die explizite Spalte „Betrag“/gross_total
          // maßgeblich. Die danebenstehende Netto-Spalte darf nie summiert oder
          // nochmals um USt. hochgerechnet werden.
          const sourceTotal = expensesOnlyMode ? (li.gross_total ?? li.total) : li.total;
          const liTotal = expensesOnlyMode ? Math.abs(Number(sourceTotal)) : Number(sourceTotal);
          rateGroups[rateKey].sum += liTotal;
          lineItemsSum += liTotal;
          if (li.description) rateGroups[rateKey].descriptions.push(li.description);
        }

        // Sind die Positionspreise Netto- oder Bruttowerte?
        const aiNet = Number(extractedData.amount_net);
        const aiGrossVal = Number(extractedData.amount_gross);
        const closeTo = (a: number, b: number) =>
          Number.isFinite(a) && Number.isFinite(b) && b > 0 && Math.abs(a - b) / Math.max(b, 1) < 0.01;
        // Im Ausgaben-Filter-Modus sind die gefilterten Positionsbeträge die tatsächlich
        // belasteten Beträge (brutto) – nicht hochrechnen.
        const lineItemsAreNet = expensesOnlyMode
          ? false
          : (rawData.line_items_are_net === true ||
            (closeTo(Math.abs(lineItemsSum), aiNet) && !closeTo(Math.abs(lineItemsSum), aiGrossVal)));
        // Positionssumme → Bruttowert je Satz
        const toGross = (sum: number, rate: number) =>
          lineItemsAreNet && rate > 0 ? sum * (1 + rate / 100) : sum;
        if (lineItemsAreNet) {
          console.log(`[LineItems] Positionspreise als NETTO erkannt (Summe ${Math.round(lineItemsSum * 100) / 100})`);
        }

        const rateKeys = Object.keys(rateGroups);
        // Gesamt-Brutto laut Positionen (mit korrekten Vorzeichen)
        const lineItemsGrossTotal = Math.round(
          rateKeys.reduce((s, k) => s + toGross(rateGroups[k].sum, parseFloat(k)), 0) * 100
        ) / 100;

        // Im Ausgaben-Filter-Modus aggregieren wir die explizit ausgewiesenen
        // Netto-/USt.-Spalten direkt. Das schützt vor dem Fehler „14,01 netto“.
        if (expensesOnlyMode) {
          const explicitNet = validLineItems.reduce((sum: number, li: any) => {
            const value = Number(li?.net_total);
            return sum + (Number.isFinite(value) ? Math.abs(value) : 0);
          }, 0);
          const explicitTax = validLineItems.reduce((sum: number, li: any) => {
            const value = Number(li?.tax_amount);
            return sum + (Number.isFinite(value) ? Math.abs(value) : 0);
          }, 0);
          extractedData.amount_gross = lineItemsGrossTotal;
          if (explicitNet > 0 || explicitTax > 0) {
            extractedData.amount_net = Math.round(explicitNet * 100) / 100;
            extractedData.vat_amount = Math.round(explicitTax * 100) / 100;
          }
          console.log(`[Expenses Line Columns] Brutto=${lineItemsGrossTotal}, Netto=${extractedData.amount_net}, USt=${extractedData.vat_amount}`);
        }

        // Vollständigkeits-/Plausibilitätscheck gegen die beschriftete Summenzeile
        let totalsConflict = false;
        if (anchorGross != null && anchorGross > 0) {
          const deviation = Math.abs(Math.abs(lineItemsGrossTotal) - anchorGross) / anchorGross;
          if (deviation > 0.02) {
            totalsConflict = true;
            console.warn(
              `[Totals Conflict] Positionssumme ${lineItemsGrossTotal} weicht ${(deviation * 100).toFixed(1)}% von der Summenzeile ${anchorGross} ab → Summenzeile gewinnt`
            );
          }
        }

        if (totalsConflict) {
          // Positionen sind unvollständig/unzuverlässig → nur informativ speichern
          extractedData.amount_gross = anchorGross!;
          if (anchorNet != null && anchorNet > 0 && anchorNet <= anchorGross!) {
            extractedData.amount_net = anchorNet;
            extractedData.vat_amount = Math.round((anchorGross! - anchorNet) * 100) / 100;
            const impliedRate = anchorNet > 0
              ? Math.round(((anchorGross! - anchorNet) / anchorNet) * 100)
              : null;
            if (impliedRate != null && impliedRate >= 0 && impliedRate <= 30) {
              extractedData.vat_rate = impliedRate;
              extractedData.is_mixed_tax_rate = false;
              extractedData.tax_rate_details = null;
            }
          }
          (extractedData as any).vat_detection_method = 'totals_line_conflict';
          (extractedData as any).vat_confidence = Math.min(
            Number((extractedData as any).vat_confidence) || 0.6, 0.6
          );
        } else if (rateKeys.length > 1) {
          const newDetails = rateKeys.map(rateStr => {
            const rate = parseFloat(rateStr);
            const gross = toGross(rateGroups[rateStr].sum, rate);
            const netAmount = rate === 0 ? gross : gross / (1 + rate / 100);
            const taxAmount = gross - netAmount;
            return {
              rate,
              net_amount: Math.round(netAmount * 100) / 100,
              tax_amount: Math.round(taxAmount * 100) / 100,
              description: rateGroups[rateStr].descriptions.join(', '),
            };
          });
          extractedData.tax_rate_details = newDetails;
          extractedData.is_mixed_tax_rate = true;
          extractedData.amount_net = Math.round(newDetails.reduce((s, d) => s + d.net_amount, 0) * 100) / 100;
          extractedData.vat_amount = Math.round(newDetails.reduce((s, d) => s + d.tax_amount, 0) * 100) / 100;
          extractedData.amount_gross = Math.round((extractedData.amount_net + extractedData.vat_amount) * 100) / 100;

        } else if (rateKeys.length === 1) {
          // Single-Rate: Summenzeile schlägt Positionssumme, sonst Truth-from-LineItems
          const rate = parseFloat(rateKeys[0]);
          const lineItemsGross = Math.round(toGross(rateGroups[rateKeys[0]].sum, rate) * 100) / 100;
          const aiGross = Number(extractedData.amount_gross) || 0;
          // Anker vorhanden → immer der Anker; sonst Positionssumme bei >1% Abweichung
          const useLineItemGross = anchorGross != null
            ? false
            : (aiGross === 0 || Math.abs(Math.abs(lineItemsGross) - aiGross) / Math.max(aiGross, 1) > 0.01);
          const gross = useLineItemGross ? lineItemsGross : (anchorGross ?? aiGross);
          const calculatedNet = rate === 0 ? gross : gross / (1 + rate / 100);
          const calculatedTax = gross - calculatedNet;
          const explicitNet = Number(extractedData.amount_net);
          const explicitTax = Number(extractedData.vat_amount);
          const hasExplicitExpenseColumns = expensesOnlyMode && explicitNet > 0 && explicitTax >= 0
            && Math.abs((explicitNet + explicitTax) - gross) <= 0.05;
          const netAmount = hasExplicitExpenseColumns ? explicitNet : calculatedNet;
          const taxAmount = hasExplicitExpenseColumns ? explicitTax : calculatedTax;
          const prevRate = extractedData.vat_rate;
          extractedData.vat_rate = rate;
          extractedData.amount_gross = Math.round(gross * 100) / 100;
          extractedData.amount_net = Math.round(netAmount * 100) / 100;
          extractedData.vat_amount = Math.round(taxAmount * 100) / 100;
          extractedData.is_mixed_tax_rate = false;
          extractedData.tax_rate_details = null;
          (extractedData as any).vat_detection_method = anchorGross != null ? 'totals_line' : 'line_items';
          (extractedData as any).vat_confidence = 1.0;
          if (prevRate !== rate) {
            console.log(`[VAT Truth-from-LineItems] Single-rate ${rate}% aus ${validLineItems.length} Line Items übernommen (AI-Aggregat war ${prevRate}%)`);
          }
        }
      }

      // Endergebnis positiv normalisieren (Gutschriften werden als Betrag geführt)
      if (Number(extractedData.amount_gross) < 0) extractedData.amount_gross = Math.abs(Number(extractedData.amount_gross));
      if (Number(extractedData.amount_net) < 0) extractedData.amount_net = Math.abs(Number(extractedData.amount_net));
      if (Number(extractedData.vat_amount) < 0) extractedData.vat_amount = Math.abs(Number(extractedData.vat_amount));



      // ── Fallback: recalculate tax_rate_details with correct math if line_items didn't trigger ──
      if (!extractedData.is_mixed_tax_rate && Array.isArray(extractedData.tax_rate_details) && extractedData.tax_rate_details.length > 1) {
        const detailRates = [...new Set(extractedData.tax_rate_details.map((t: any) => Number(t?.rate)).filter((r: number) => !Number.isNaN(r)))];
        if (detailRates.length > 1) {
          extractedData.tax_rate_details = extractedData.tax_rate_details.map((d: any) => {
            const rate = Number(d.rate) || 0;
            const gross = Number(d.net_amount) + Number(d.tax_amount);
            const netAmount = rate === 0 ? gross : gross / (1 + rate / 100);
            const taxAmount = gross - netAmount;
            return { ...d, net_amount: Math.round(netAmount * 100) / 100, tax_amount: Math.round(taxAmount * 100) / 100 };
          });
          extractedData.is_mixed_tax_rate = true;
          extractedData.amount_net = Math.round(extractedData.tax_rate_details.reduce((s: number, t: any) => s + t.net_amount, 0) * 100) / 100;
          extractedData.vat_amount = Math.round(extractedData.tax_rate_details.reduce((s: number, t: any) => s + t.tax_amount, 0) * 100) / 100;
          
        }
      }

      // ── Post-Processing: VAT consistency (skip for mixed tax rates) ──
      if (extractedData.amount_gross != null && !extractedData.is_mixed_tax_rate) {
        // Truth-from-Line-Items dominiert: Rule 0 nur ausführen, wenn weder Line Items
        // noch tax_rate_details einen positiven Steuersatz belegen.
        const lineItemsHavePositiveRate = validLineItems.some((li: any) => {
          const r = parseFloat(String(li.tax_rate).replace(',', '.').replace('%', ''));
          return Number.isFinite(r) && r > 0;
        });
        const detailsHavePositiveRate = Array.isArray(extractedData.tax_rate_details)
          && extractedData.tax_rate_details.some((d: any) => Number(d?.rate) > 0);
        const skipRule0 = lineItemsHavePositiveRate || detailsHavePositiveRate;

        // Rule 0: Explicit 0% in document
        const zeroVatPattern = /0[,.]?0{0,2}\s*%\s*(USt|MwSt|Ust|mwst|umsatzsteuer)/i;
        if (!skipRule0 && zeroVatPattern.test(content) && extractedData.vat_rate !== 0) {
          console.log(`[VAT Consistency] Rule 0: Explicit 0% found, correcting from ${extractedData.vat_rate}%`);
          extractedData.vat_rate = 0;
          extractedData.vat_amount = 0;
          extractedData.amount_net = extractedData.amount_gross;
        } else if (skipRule0 && zeroVatPattern.test(content) && extractedData.vat_rate !== 0) {
          console.log(`[VAT Consistency] Rule 0 übersprungen: Line Items / tax_rate_details belegen positive Steuersätze (Truth-from-LineItems)`);
        }

        // Rule 1: Gross == Net and no VAT
        if (extractedData.amount_gross === extractedData.amount_net && (!extractedData.vat_amount || extractedData.vat_amount === 0)) {
          if (extractedData.vat_rate && extractedData.vat_rate > 0) {
            console.log(`[VAT Consistency] Rule 1: Gross=Net, correcting vat_rate to 0`);
          }
          extractedData.vat_rate = 0;
          extractedData.vat_amount = 0;
        }

        // Rule 2: Rate > 0, VAT amount exists, but Net missing/equal Gross
        if (extractedData.vat_rate != null && extractedData.vat_rate > 0 && extractedData.vat_amount != null && extractedData.vat_amount > 0
            && (!extractedData.amount_net || extractedData.amount_net === extractedData.amount_gross)) {
          extractedData.amount_net = Math.round((extractedData.amount_gross - extractedData.vat_amount) * 100) / 100;
          console.log(`[VAT Consistency] Rule 2: Net=${extractedData.amount_net}`);
        }

        // Rule 3: Rate > 0, no VAT amount, no Net
        if (extractedData.vat_rate != null && extractedData.vat_rate > 0
            && (!extractedData.vat_amount || extractedData.vat_amount === 0)
            && (!extractedData.amount_net || extractedData.amount_net === extractedData.amount_gross)) {
          extractedData.amount_net = Math.round((extractedData.amount_gross / (1 + extractedData.vat_rate / 100)) * 100) / 100;
          extractedData.vat_amount = Math.round((extractedData.amount_gross - extractedData.amount_net) * 100) / 100;
          console.log(`[VAT Consistency] Rule 3: Net=${extractedData.amount_net}, VAT=${extractedData.vat_amount}`);
        }

        // Rule 4: Net < Gross, no VAT amount
        if (extractedData.amount_net != null && extractedData.amount_net < extractedData.amount_gross
            && (!extractedData.vat_amount || extractedData.vat_amount === 0)) {
          extractedData.vat_amount = Math.round((extractedData.amount_gross - extractedData.amount_net) * 100) / 100;
          console.log(`[VAT Consistency] Rule 4: VAT=${extractedData.vat_amount}`);
        }

        // Rule 5: Brutto darf niemals kleiner als Netto sein → aus Netto + USt rekonstruieren
        if (extractedData.amount_net != null && extractedData.amount_gross != null
            && Number(extractedData.amount_net) - Number(extractedData.amount_gross) > 0.02) {
          const vat = Number(extractedData.vat_amount) > 0
            ? Number(extractedData.vat_amount)
            : Number(extractedData.amount_net) * (Number(extractedData.vat_rate) || 0) / 100;
          const fixedGross = Math.round((Number(extractedData.amount_net) + vat) * 100) / 100;
          console.log(`[VAT Consistency] Rule 5: Brutto ${extractedData.amount_gross} < Netto ${extractedData.amount_net} → korrigiert auf ${fixedGross}`);
          extractedData.amount_gross = fixedGross;
          extractedData.vat_amount = Math.round(vat * 100) / 100;
          (extractedData as any).vat_detection_method = 'totals_line_conflict';
          (extractedData as any).vat_confidence = 0.5;
        }
      }


      // ── Non-receipt document handling ─────────────────────────────
      if (extractedData.is_receipt === false && !forceTreatAsReceipt) {
        console.log("Document is NOT a receipt:", { document_type: extractedData.document_type, reason: extractedData.reason });

        if (receiptId) {
          const documentDescription = extractedData.document_type
            ? `${extractedData.document_type}${extractedData.reason ? `: ${extractedData.reason}` : ''}`
            : 'Kein Rechnungsdokument';

          await supabase.from('receipts').update({
            // Own status: keeps these documents out of the review queue and out
            // of the "no data extracted" banner, but still findable + reversible.
            status: 'not_a_receipt',
            category: 'Keine Rechnung',
            description: documentDescription.substring(0, 100),
            ai_confidence: 0.5,
            notes: `Dokumenttyp: ${extractedData.document_type || 'Unbekannt'}. ${extractedData.reason || 'Kann als Hilfsdokument verwendet werden.'}`,
            ai_raw_response: extractedData,
            ai_processed_at: new Date().toISOString(),
            prompt_version: 'v2',
          }).eq('id', receiptId);
        }

        return new Response(
          JSON.stringify({ success: true, is_receipt: false, saved_as_supplementary: true, document_type: extractedData.document_type, reason: extractedData.reason, receiptId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (extractedData.is_receipt === false && forceTreatAsReceipt) {
        console.log("Override: treating non-receipt as receipt:", { document_type: extractedData.document_type });
        // Force-through: continue normal receipt flow with whatever fields we got.
        extractedData.is_receipt = true;
      }

      // ── Receipt data: learning & DB update ───────────────────────
      console.log("Extracted receipt:", { vendor: extractedData.vendor, amount_gross: extractedData.amount_gross, invoice_number: extractedData.invoice_number, confidence: extractedData.confidence });

      if (receiptId) {
        let finalVatRate = extractedData.vat_rate;
        let vatRateSource: 'ai' | 'learned' = 'ai';
        let finalCategory = extractedData.category;

        const receiptUserId = receipt?.user_id || null;
        // Vendor resolved during matching below — persisted with the receipt so
        // server-side processing (retry, email import, batch) links the vendor
        // just like the client flow does.
        let resolvedVendorId: string | null = receipt?.vendor_id ?? null;

        if (receiptUserId && extractedData.vendor) {
          // Vendor matching via the shared matcher (exact → legal names →
          // normalized → brand → fuzzy), identical to `reconcile-vendors`.
          const { data: allVendors } = await supabase
            .from('vendors')
            .select('id, display_name, expenses_only_extraction, legal_names, default_category_id, always_not_a_receipt')
            .eq('user_id', receiptUserId);

          // Receipt volume per vendor — used as a tiebreaker / confidence signal.
          const { data: vendorStats } = await supabase.rpc('get_vendor_stats', { p_user_id: receiptUserId });
          const receiptCounts: Record<string, number> = {};
          for (const row of (vendorStats as any[]) || []) {
            if (row?.vendor_id) receiptCounts[row.vendor_id] = Number(row.receipt_count) || 0;
          }

          const finalVendorMatch: any =
            matchVendor(allVendors as any[], extractedData.vendor, extractedData.vendor_brand, receiptCounts) || null;

          if (finalVendorMatch) {
            console.log(`[Vendor Match] "${extractedData.vendor}" → "${finalVendorMatch.display_name}"`);
          }



          const vendorId = receipt?.vendor_id || finalVendorMatch?.id;
          resolvedVendorId = vendorId ?? null;

          // ── Vendor rule: always treat documents of this vendor as "Keine Rechnung" ──
          if (finalVendorMatch?.always_not_a_receipt && !forceTreatAsReceipt && receiptId) {
            console.log(`[Vendor Rule] "${finalVendorMatch.display_name}" ist als "Keine Rechnung" hinterlegt → not_a_receipt`);
            await supabase.from('receipts').update({
              status: 'not_a_receipt',
              category: 'Keine Rechnung',
              vendor_id: vendorId ?? null,
              description: (extractedData.description || 'Kein Rechnungsdokument').substring(0, 100),
              ai_confidence: extractedData.confidence ?? 0.5,
              notes: `Regel: Lieferant "${finalVendorMatch.display_name}" ist als "Keine Rechnung" hinterlegt.`,
              ai_raw_response: extractedData,
              ai_processed_at: new Date().toISOString(),
              prompt_version: 'v2',
            }).eq('id', receiptId);

            return new Response(
              JSON.stringify({ success: true, is_receipt: false, vendor_rule: 'always_not_a_receipt', receiptId }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Auto-learn legal_names: if AI extracted a name with legal form and
          // the matched vendor doesn't yet know it, add it. Also upgrade
          // display_name when current display_name lacks a legal form but the
          // new one provides it.
          if (finalVendorMatch && extractedData.vendor) {
            const aiName = extractedData.vendor.trim();
            const aiNameLower = aiName.toLowerCase();
            const currentDisplay = (finalVendorMatch.display_name || '').trim();
            const knownNames = new Set<string>([
              currentDisplay.toLowerCase(),
              ...(finalVendorMatch.legal_names || []).map((n: string) => n.toLowerCase()),
            ]);

            const updates: Record<string, any> = {};
            if (hasLegalForm(aiName) && !knownNames.has(aiNameLower)) {
              const newLegalNames = [...(finalVendorMatch.legal_names || []), aiName];
              updates.legal_names = newLegalNames;
            }
            // Upgrade display_name when current is the bare brand and AI gave the full legal name
            if (
              hasLegalForm(aiName) &&
              !hasLegalForm(currentDisplay) &&
              normalizeVendorName(currentDisplay) === normalizeVendorName(aiName) &&
              currentDisplay.toLowerCase() !== aiNameLower
            ) {
              updates.display_name = aiName;
            }
            if (Object.keys(updates).length > 0) {
              const { error: vendorUpdateError } = await supabase
                .from('vendors')
                .update(updates)
                .eq('id', finalVendorMatch.id);
              if (vendorUpdateError) {
                console.warn(`[Vendor Learning] Failed to update vendor ${finalVendorMatch.id}:`, vendorUpdateError);
              } else {
                console.log(`[Vendor Learning] Updated vendor ${finalVendorMatch.id}:`, updates);
              }
            }
          }


          // Category & tax_type learning: vendor-scoped keyword > global keyword > vendor default > AI
          if (extractedData.description) {
            const { data: categoryRules } = await supabase
              .from('category_rules')
              .select('keyword, category_name, match_count, tax_type_name, tax_type_match_count, vendor_id')
              .eq('user_id', receiptUserId)
              .or(`vendor_id.eq.${vendorId ?? '00000000-0000-0000-0000-000000000000'},vendor_id.is.null`)
              .order('match_count', { ascending: false });

            if (categoryRules && categoryRules.length > 0) {
              const descLower = extractedData.description.toLowerCase();
              
              // Also check line items
              const lineItemDescs: string[] = [];
              if ((rawData as any).line_items && Array.isArray((rawData as any).line_items)) {
                for (const item of (rawData as any).line_items) {
                  if (item?.description) lineItemDescs.push(item.description.toLowerCase());
                }
              }
              
              const allText = [descLower, ...lineItemDescs].join(' ');
              
              // Pass 1: vendor-scoped (threshold 2). Pass 2: global (threshold 3).
              const vendorRules = categoryRules.filter(r => r.vendor_id === vendorId && vendorId);
              const globalRules = categoryRules.filter(r => !r.vendor_id);
              
              const findMatch = (rules: typeof categoryRules, catThreshold: number, taxThreshold: number) => {
                const rule = rules.find(r => allText.includes(r.keyword.toLowerCase()));
                if (!rule) return;
                if (rule.category_name && (rule.match_count || 0) >= catThreshold) {
                  console.log(`[Category Learning] ${rule.vendor_id ? 'Vendor' : 'Global'} rule: "${rule.keyword}" → "${rule.category_name}"`);
                  finalCategory = rule.category_name;
                }
                if (rule.tax_type_name && (rule.tax_type_match_count || 0) >= taxThreshold) {
                  console.log(`[Tax Type Learning] ${rule.vendor_id ? 'Vendor' : 'Global'} rule: "${rule.keyword}" → "${rule.tax_type_name}"`);
                  extractedData.tax_type = rule.tax_type_name;
                }
              };
              
              findMatch(vendorRules, 2, 2);
              if (finalCategory === extractedData.category) findMatch(globalRules, 3, 3);
            }
          }

          if (finalCategory === extractedData.category && finalVendorMatch?.default_category_id) {
            const { data: vendorCategory } = await supabase
              .from('categories')
              .select('name')
              .eq('id', finalVendorMatch.default_category_id)
              .maybeSingle();
            if (vendorCategory?.name) {
              console.log(`[Category Learning] Vendor default: "${vendorCategory.name}"`);
              finalCategory = vendorCategory.name;
            }
          }

          // Vendor explicit default_tax_type or learned field_defaults (only if not already set by keyword rule)
          if (vendorId && !extractedData.tax_type) {
            const { data: vendorDefaults } = await supabase
              .from('vendors')
              .select('default_tax_type, field_defaults')
              .eq('id', vendorId)
              .maybeSingle();

            const fieldDefaults = (vendorDefaults?.field_defaults as Record<string, string>) || {};
            if (vendorDefaults?.default_tax_type) {
              console.log(`[Tax Type] Vendor explicit default: "${vendorDefaults.default_tax_type}"`);
              extractedData.tax_type = vendorDefaults.default_tax_type;
            } else if (fieldDefaults.tax_type) {
              console.log(`[Tax Type Learning] Vendor learned default: "${fieldDefaults.tax_type}"`);
              extractedData.tax_type = fieldDefaults.tax_type;
            }
          }

          if (vendorId) {
            const { data: learning } = await supabase
              .from('vendor_learning')
              .select('default_vat_rate, vat_rate_confidence, vat_rate_corrections')
              .eq('vendor_id', vendorId)
              .eq('user_id', receiptUserId)
              .eq('is_active', true)
              .maybeSingle();

            if (learning?.default_vat_rate !== null && learning?.default_vat_rate !== undefined) {
              const shouldUseLearned = (learning.vat_rate_confidence ?? 0) >= 70 || (learning.vat_rate_corrections ?? 0) >= 3;
              if (shouldUseLearned) {
                console.log(`[VAT Learning] Using learned rate ${learning.default_vat_rate}% (AI: ${extractedData.vat_rate}%)`);
                finalVatRate = Number(learning.default_vat_rate);
                vatRateSource = 'learned';
              }
            }
          }
        }

        // Validate finalCategory strictly against the user's category list.
        // Anything that doesn't exactly (case-insensitive) match a real user category → null.
        if (finalCategory && userCategoryNames.length > 0) {
          const match = userCategoryNames.find(n => n.toLowerCase() === finalCategory!.toLowerCase());
          if (!match) {
            console.log(`[Category Validation] Dropping invented category "${finalCategory}" (not in user list)`);
            finalCategory = null;
          } else if (match !== finalCategory) {
            finalCategory = match; // normalize casing
          }
        } else if (finalCategory && userCategoryNames.length === 0) {
          finalCategory = null;
        }

        // Auto-approve: mirror the client-side rule — vendor has auto_approve
        // enabled and the AI confidence reaches the vendor's threshold.
        let finalStatus: string = 'review';
        let autoApproved = false;
        let vendorDefaultTagId: string | null = null;
        if (resolvedVendorId) {
          const { data: vendorAuto } = await supabase
            .from('vendors')
            .select('auto_approve, auto_approve_min_confidence, default_tag_id')
            .eq('id', resolvedVendorId)
            .maybeSingle();

          vendorDefaultTagId = (vendorAuto as any)?.default_tag_id ?? null;

          if (vendorAuto?.auto_approve) {
            const confidence = Number(extractedData.confidence ?? 0);
            const minConfidence = Number(vendorAuto.auto_approve_min_confidence ?? 0.8);
            const needsSplitting = (extractedData as any)?.split_suggestion?.contains_multiple_invoices === true;
            const totalsConflict = (extractedData as any)?.vat_detection_method === 'totals_line_conflict';
            if (confidence >= minConfidence && !needsSplitting && !totalsConflict) {
              finalStatus = 'approved';
              autoApproved = true;
              console.log(`[Auto-Approve] Receipt ${receiptId} approved (confidence ${confidence} >= ${minConfidence})`);
            } else if (totalsConflict) {
              console.log(`[Auto-Approve] Receipt ${receiptId} blockiert: Positionssumme passt nicht zur Summenzeile`);
            }

          }
        }

        const { error: updateError } = await supabase.from('receipts').update({
          vendor_id: resolvedVendorId,
          auto_approved: autoApproved,
          vendor: extractedData.vendor,
          vendor_brand: extractedData.vendor_brand,
          description: extractedData.description,
          amount_gross: extractedData.amount_gross,
          amount_net: extractedData.amount_net,
          vat_amount: extractedData.vat_amount,
          vat_rate: finalVatRate,
          vat_rate_source: vatRateSource,
          is_mixed_tax_rate: extractedData.is_mixed_tax_rate || false,
          tax_rate_details: extractedData.tax_rate_details || null,
          receipt_date: extractedData.receipt_date,
          category: finalCategory,
          tax_type: (extractedData.tax_type = validateTaxType(extractedData.tax_type, extractedData.vendor_country)),
          // payment_method no longer set from AI extraction
          invoice_number: extractedData.invoice_number,
          ai_confidence: extractedData.confidence,
          ai_raw_response: extractedData,
          ai_processed_at: new Date().toISOString(),
          status: finalStatus,
          vendor_country: extractedData.vendor_country || null,
          vat_confidence: vatRateSource === 'learned' ? 1.0 : (extractedData.vat_confidence || null),
          vat_detection_method: vatRateSource === 'learned' ? 'learned' : (extractedData.vat_detection_method || null),
          special_vat_case: extractedData.special_vat_case || null,
          line_items_raw: (rawData as any).line_items || null,
          prompt_version: 'v2',
        }).eq('id', receiptId);

        if (updateError) {
          console.error("Failed to update receipt:", updateError);
        } else {
          console.log(`Receipt ${receiptId} updated (V2, VAT: ${vatRateSource})`);

          // Standard-Tag des Lieferanten zuweisen (falls hinterlegt)
          if (vendorDefaultTagId) {
            try {
              const { error: tagError } = await supabase
                .from('receipt_tags')
                .upsert(
                  { receipt_id: receiptId, tag_id: vendorDefaultTagId },
                  { onConflict: 'receipt_id,tag_id', ignoreDuplicates: true }
                );
              if (tagError) {
                console.error('[Default Tag] Zuweisung fehlgeschlagen:', tagError.message);
              } else {
                console.log(`[Default Tag] Tag ${vendorDefaultTagId} → Receipt ${receiptId}`);
              }
            } catch (e) {
              console.error('[Default Tag] Fehler:', e);
            }
          }



          // Post-save duplicate recheck (handles race condition with parallel uploads).
          // Regeln: echte Rechnungsnummer + Lieferant = Duplikat; sonst Betrag ±20 % und Datum ±3 Tage.
          try {
            if (userId) {
              const invNo = normalizeInvoiceNumber(extractedData.invoice_number);
              const sinceIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
              const activeStatuses = ['pending', 'processing', 'review', 'approved', 'duplicate'];

              const { data: self } = await supabase
                .from('receipts')
                .select('id, file_hash, created_at, vendor, vendor_brand, file_name, custom_filename, description, amount_gross, receipt_date')
                .eq('id', receiptId)
                .single();

              // Tag "Inoffiziell" → keine automatische Duplikatmarkierung
              const { data: ownTags } = await supabase
                .from('receipt_tags')
                .select('tags!inner(name)')
                .eq('receipt_id', receiptId);
              const isInoffiziell = (ownTags || []).some((t: any) =>
                String(t.tags?.name || '').toLowerCase().includes('inoffiziell')
              );

              const cols = 'id, vendor, vendor_brand, invoice_number, amount_gross, receipt_date, file_hash, file_name, custom_filename, description, created_at';
              let match: any = null;
              let reasons: string[] = [];
              let score = 90;

              if (self && !isInoffiziell) {
                const selfVendor = extractedData.vendor_name || self.vendor;

                if (invNo) {
                  const { data: byInvoice } = await supabase
                    .from('receipts')
                    .select(cols)
                    .eq('user_id', userId)
                    .eq('invoice_number', invNo)
                    .in('status', activeStatuses)
                    .neq('id', receiptId)
                    .limit(5);

                  match = (byInvoice || []).find((s: any) =>
                    invoiceNumbersMatch(invNo, s.invoice_number) &&
                    (vendorsLikelySame(selfVendor, s.vendor) || vendorsLikelySame(selfVendor, s.vendor_brand))
                  ) || null;

                  if (match) {
                    score = 95;
                    reasons = ['Gleiche Rechnungsnummer', 'Gleicher Lieferant'];
                    const ownKind = classifyDocumentKind(self as any);
                    const otherKind = classifyDocumentKind(match);
                    if (
                      amountsEqual(extractedData.amount_gross, match.amount_gross) &&
                      ownKind !== otherKind &&
                      (ownKind === 'payment_receipt' || otherKind === 'payment_receipt') &&
                      (ownKind === 'invoice' || otherKind === 'invoice')
                    ) {
                      reasons.push('Zahlungsbeleg zur Rechnung');
                    }
                  }
                }

                if (!match && extractedData.amount_gross != null && extractedData.receipt_date) {
                  const { data: recent } = await supabase
                    .from('receipts')
                    .select(cols)
                    .eq('user_id', userId)
                    .in('status', activeStatuses)
                    .neq('id', receiptId)
                    .gte('updated_at', sinceIso)
                    .limit(50);

                  match = (recent || []).find((s: any) => {
                    if (self.file_hash && s.file_hash && self.file_hash === s.file_hash) return true;
                    const candInv = normalizeInvoiceNumber(s.invoice_number);
                    if (invNo && candInv && !invoiceNumbersMatch(invNo, candInv)) return false;
                    if (!amountWithinTolerance(extractedData.amount_gross, s.amount_gross)) return false;
                    if (!dateWithinTolerance(extractedData.receipt_date, s.receipt_date)) return false;
                    return true;
                  }) || null;

                  if (match) {
                    const exact =
                      amountsEqual(extractedData.amount_gross, match.amount_gross) &&
                      (daysBetween(extractedData.receipt_date, match.receipt_date) ?? 99) === 0;
                    const vendorOk =
                      vendorsLikelySame(selfVendor, match.vendor) || vendorsLikelySame(selfVendor, match.vendor_brand);
                    score = (vendorOk ? 90 : 60) - (exact ? 0 : 10);
                    reasons = [
                      exact ? 'Gleicher Betrag' : 'Betrag leicht abweichend',
                      exact ? 'Gleiches Datum' : 'Datum leicht abweichend',
                    ];
                    if (vendorOk) reasons.push('Gleicher Lieferant');
                  }
                }
              }

              if (match && self) {
                // Mark the NEWER one as the duplicate of the OLDER one
                const selfIsNewer = new Date(self.created_at).getTime() >= new Date(match.created_at).getTime();
                const dupId = selfIsNewer ? receiptId : match.id;
                const ofId = selfIsNewer ? match.id : receiptId;
                await supabase.from('receipts').update({
                  is_duplicate: true,
                  duplicate_of: ofId,
                  duplicate_score: score,
                  duplicate_checked_at: new Date().toISOString(),
                  notes: `Mögliches Duplikat (Auto-Recheck): ${reasons.join(', ')}`,
                }).eq('id', dupId);
                console.log(`[DupRecheck] Marked ${dupId} as duplicate of ${ofId} (${reasons.join(', ')})`);
              }
            }
          } catch (recheckErr) {
            console.error('[DupRecheck] failed:', recheckErr);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, is_receipt: true, data: extractedData, raw_response: content, receiptId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      const msg = parseError instanceof Error ? `${parseError.message}\n${parseError.stack}` : String(parseError);
      console.error("Post-processing failed:", msg);
      // Fallback: Receipt auf review setzen, damit er nicht auf processing hängen bleibt
      if (receiptId) {
        await supabase.from('receipts').update({
          status: 'review',
          notes: 'KI-Antwort konnte nicht verarbeitet werden. Bitte manuell prüfen.',
          ai_processed_at: new Date().toISOString(),
        }).eq('id', receiptId);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Post-processing failed", details: msg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Extract receipt error:", error);
    // Fallback: Receipt auf review setzen, damit er nicht auf processing hängen bleibt
    try {
      const body = await req.clone().json().catch(() => ({}));
      const rid = body?.receiptId;
      if (rid) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(supabaseUrl, supabaseServiceKey);
        await sb.from('receipts').update({
          status: 'review',
          notes: `KI-Extraktion fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
          ai_processed_at: new Date().toISOString(),
        }).eq('id', rid);
      }
    } catch (_) { /* best effort */ }
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
