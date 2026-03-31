import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  vat_detection_method?: 'explicit' | 'calculated' | 'learned' | 'estimated' | null;
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
    tax_rate: { type: "string" as const },
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
          tax_rate: { type: "string" as const },
          category: { type: "string" as const },
        },
        required: ["description", "quantity", "unit_price", "total", "tax_rate", "category"],
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
    "receipt_number", "net_amount", "tax_amount", "is_mixed_tax_rate",
    "tax_rate_details", "description", "line_items",
    "vat_confidence", "vat_detection_method", "special_vat_case", "notes",
    "category", "tax_type",
  ],
  additionalProperties: false,
};

// ── Map structured output → internal ExtractionResult ──────────────
function mapSchemaToResult(raw: Record<string, any>): ExtractionResult {
  const taxRateStr = raw.tax_rate || "";
  let vatRate: number | null = null;
  if (taxRateStr && taxRateStr !== "unknown" && taxRateStr !== "") {
    const parsed = parseFloat(taxRateStr);
    if (!isNaN(parsed)) vatRate = parsed;
  }

  return {
    is_receipt: raw.is_financial_document === true,
    document_type: raw.document_type || undefined,
    reason: raw.reason || undefined,
    vendor: raw.vendor_name || null,
    vendor_brand: raw.vendor_brand || null,
    description: raw.description || null,
    amount_gross: raw.total_amount || null,
    amount_net: raw.net_amount || null,
    vat_amount: raw.tax_amount || null,
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

KATEGORIE-ZUORDNUNGSHILFE:
Ordne NUR Kategorien aus der obigen Liste zu. Spezifischere Kategorie bevorzugen, "Sonstiges" nur als Fallback.

TYPISCHE ZUORDNUNGEN:
- Tankstellen → KFZ; Restaurants/Hotels → Bewirtung; Bahn/Flug/Booking → Reisekosten
- Telekom → Telefon/Internet; Google/Meta Ads → Werbung; Steuerberater/Anwalt → Beratung
- Bürobedarf → Büromaterial; Banken → Bankgebühren; Versicherungen → Versicherung
- Einzelgeräte (Laptop, Monitor) → GWG; Software-Abos → Software/EDV
- Parkgebühren auf Reise → Reisekosten; tägliches Parken → KFZ
- Amazon: nach INHALT kategorisieren`;

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

// ── Expenses-only prompt builder (deduplicated) ────────────────────
function buildExpensesOnlyPrompt(keywords: string[], hint: string): string {
  let prompt = '';

  if (keywords.length > 0) {
    prompt = `

WICHTIG – NUR AUSGABEN EXTRAHIEREN:
Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten.
Extrahiere AUSSCHLIESSLICH die Positionen, die eines dieser Schlagwörter enthalten: ${keywords.join(", ")}
Ignoriere alle anderen Zeilen (Einnahmen, Gutschriften, Auszahlungen).

REGELN:
- Durchsuche ALLE Seiten des Dokuments, nicht nur die erste
- Pro Treffer: Brutto, Netto, MwSt-Satz, MwSt-Betrag erfassen
- Netto = Brutto / (1 + MwSt-Satz/100), MwSt = Brutto - Netto
- Schlagwörter können mehrfach vorkommen → jede Zeile einzeln zählen
- Ignoriere Zwischen- und Gesamtsummen — nur einzelne Kostenzeilen zählen
- Bei verschiedenen MwSt-Sätzen: is_mixed_tax_rate=true, tax_rate_details mit rate/net_amount/tax_amount/description PRO Position
- total_amount = Summe aller Brutto, net_amount = Summe aller Netto, tax_amount = Summe aller MwSt
- Alle Beträge POSITIV
- Gutschriften/Erstattungen komplett ignorieren
- description: Alle gefundenen Positionen mit jeweiligem Betrag auflisten, z.B.: "Transaktionsgebühr 3,50€; Betreiber-Abonnement 12,00€"`;
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
        max_tokens: 2048,
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

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      imageBase64 = btoa(binaryString);
      mimeType = receipt.file_type === 'pdf' ? 'application/pdf' : `image/${receipt.file_type}`;

      const isPdf = receipt.file_name?.endsWith('.pdf') || receipt.file_type === 'application/pdf' || receipt.file_type === 'pdf';
      if (isPdf) mimeType = 'application/pdf';
      console.log(`Downloaded file: ${receipt.file_name}, type: ${mimeType}`);

      // Page count for PDFs
      let pageCount = 1;
      if (isPdf) {
        pageCount = estimatePdfPageCount(uint8Array);
        console.log(`Estimated PDF page count: ${pageCount}`);
        await supabase.from('receipts').update({ page_count: pageCount }).eq('id', receiptId);
      }

      // Multi-Invoice Check
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!skipMultiCheck && isPdf && pageCount > 1 && LOVABLE_API_KEY) {
        const multiCheck = await checkForMultipleInvoices(imageBase64, mimeType, pageCount, LOVABLE_API_KEY);
        if (multiCheck.contains_multiple_invoices && multiCheck.confidence >= 0.7 && multiCheck.invoice_count >= 2) {
          console.log(`Multiple invoices detected: ${multiCheck.invoice_count}`);
          await supabase.from('receipts').update({
            status: 'needs_splitting',
            split_suggestion: multiCheck,
            notes: `${multiCheck.invoice_count} separate Rechnungen erkannt. Bitte aufteilen.`,
            ai_processed_at: new Date().toISOString(),
          }).eq('id', receiptId);

          return new Response(
            JSON.stringify({ success: true, needs_splitting: true, invoice_count: multiCheck.invoice_count, suggestion: multiCheck, receiptId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
    let categoryList = 'Sonstiges';
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
      const userCountry = userProfile?.country?.toUpperCase() || null;

      let query = supabase.from('categories').select('name, country').eq('is_hidden', false).order('sort_order');
      if (userCountry) {
        query = query.or(`user_id.eq.${userId},and(is_system.eq.true,country.eq.${userCountry})`);
      } else {
        query = query.or(`user_id.eq.${userId},is_system.eq.true`);
      }

      const { data: userCategories } = await query;
      if (userCategories && userCategories.length > 0) {
        const catNames = userCategories.map(c => c.name).filter(n => n !== 'Keine Rechnung');
        if (catNames.length > 0) {
          categoryList = catNames.join(', ');
          const categoryHints = buildCategoryHints(userCountry, catNames);
          if (categoryHints) categoryList += categoryHints;

          // Community patterns (limited to 15)
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
              categoryList += `\n\nVERIFIZIERTE ZUORDNUNGEN:\n${communityHints}`;
            }
          }

          console.log(`Using ${catNames.length} categories (country: ${userCountry}, community: ${communityPatterns?.length || 0})`);
        }
      }
    }

    // ── V2 compressed user prompt ──────────────────────────────────
    const userPrompt = `Analysiere dieses Dokument:

SCHRITT 1: Ist dies ein Finanzbeleg (Rechnung, Quittung, Kassenbon, Gutschrift)?
Wenn NEIN: is_financial_document=false, document_type angeben, reason ausfüllen. Restliche Felder leer/""/0.

SCHRITT 2: Beleg-Daten extrahieren.

LIEFERANT:
- vendor_name = Offizieller Firmenname MIT Rechtsform aus Impressum/Fußbereich
- Rechtsform erkennen: GmbH/AG/KG/OG/e.U./EU/UG/Ltd./LLC/Inc./S.à r.l./B.V./S.r.l. etc.
- vendor_brand = Markenname falls abweichend (sonst "")
- vendor_country = ISO-2-Code aus UID-Nr (ATU→AT, DE→DE, CHE→CH) oder Adresse
- Bei mehreren Firmen: RECHNUNGSSTELLER nehmen, nicht Empfänger

BESCHREIBUNG: Alle Positionen zusammenfassen, max 100 Zeichen, keine Preise.

KATEGORIE: Wähle passendste aus: ${categoryList}

BUCHUNGSART (tax_type): Steuerliche Einordnung nach DACH-Steuerrecht.
Mögliche Werte: Betriebsausgabe, GWG bis 1.000€, Bewirtung 50%, Bewirtung 100%, Vorsteuer abzugsfähig, Reisekosten, Kfz-Kosten, Repräsentation, Abschreibung, Sonstige.
Regeln: Gerät/Hardware >1.000€ netto → Abschreibung. Gerät ≤1.000€ → GWG bis 1.000€. Restaurant/Bewirtung → Bewirtung 50%. Tankstelle/Mietwagen → Kfz-Kosten. Hotel/Flug/Bahn → Reisekosten. Nur wenn eindeutig erkennbar, sonst "".
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
receipt_number: Rechnungsnummer suchen (RE-Nr, Invoice, Belegnummer etc.) oder "".
receipt_number: Rechnungsnummer suchen (RE-Nr, Invoice, Belegnummer etc.) oder "".

LINE_ITEMS: Jede Rechnungsposition einzeln erfassen mit Kategorie. Keine Summenzeilen.${expensesOnlyPrompt}${extractionHintPrompt}`;

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
        max_tokens: 2048,
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

    try {
      const rawData = JSON.parse(cleanedContent);
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

      // ── Post-Processing: VAT consistency ─────────────────────────
      if (extractedData.amount_gross != null) {
        // Rule 0: Explicit 0% in document
        const zeroVatPattern = /0[,.]?0{0,2}\s*%\s*(USt|MwSt|Ust|mwst|umsatzsteuer)/i;
        if (zeroVatPattern.test(content) && extractedData.vat_rate !== 0) {
          console.log(`[VAT Consistency] Rule 0: Explicit 0% found, correcting from ${extractedData.vat_rate}%`);
          extractedData.vat_rate = 0;
          extractedData.vat_amount = 0;
          extractedData.amount_net = extractedData.amount_gross;
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
      }

      // ── Non-receipt document handling ─────────────────────────────
      if (extractedData.is_receipt === false) {
        console.log("Document is NOT a receipt:", { document_type: extractedData.document_type, reason: extractedData.reason });

        if (receiptId) {
          const documentDescription = extractedData.document_type
            ? `${extractedData.document_type}${extractedData.reason ? `: ${extractedData.reason}` : ''}`
            : 'Kein Rechnungsdokument';

          await supabase.from('receipts').update({
            status: 'review',
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

      // ── Receipt data: learning & DB update ───────────────────────
      console.log("Extracted receipt:", { vendor: extractedData.vendor, amount_gross: extractedData.amount_gross, invoice_number: extractedData.invoice_number, confidence: extractedData.confidence });

      if (receiptId) {
        let finalVatRate = extractedData.vat_rate;
        let vatRateSource: 'ai' | 'learned' = 'ai';
        let finalCategory = extractedData.category;

        const receiptUserId = receipt?.user_id || null;

        if (receiptUserId && extractedData.vendor) {
          // Vendor matching
          const { data: vendorMatch } = await supabase
            .from('vendors')
            .select('id, expenses_only_extraction, legal_names, default_category_id')
            .eq('user_id', receiptUserId)
            .or(`display_name.ilike.${extractedData.vendor}`)
            .maybeSingle();

          let finalVendorMatch = vendorMatch;
          if (!finalVendorMatch) {
            const { data: allVendors } = await supabase
              .from('vendors')
              .select('id, expenses_only_extraction, legal_names, default_category_id')
              .eq('user_id', receiptUserId);
            if (allVendors) {
              finalVendorMatch = allVendors.find(v =>
                (v.legal_names || []).some((ln: string) => ln.toLowerCase() === extractedData.vendor!.toLowerCase())
              ) || null;
            }
          }

          const vendorId = receipt?.vendor_id || finalVendorMatch?.id;

          // Category learning: product rule > vendor default > AI
          if (extractedData.description) {
            const { data: categoryRules } = await supabase
              .from('category_rules')
              .select('keyword, category_name, match_count')
              .eq('user_id', receiptUserId)
              .order('match_count', { ascending: false });

            if (categoryRules && categoryRules.length > 0) {
              const descLower = extractedData.description.toLowerCase();
              const matchedRule = categoryRules.find(rule => descLower.includes(rule.keyword.toLowerCase()));
              if (matchedRule) {
                console.log(`[Category Learning] Product rule: "${matchedRule.keyword}" → "${matchedRule.category_name}"`);
                finalCategory = matchedRule.category_name;
              }
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

          // VAT learning
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

        const { error: updateError } = await supabase.from('receipts').update({
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
          tax_type: extractedData.tax_type || null,
          // payment_method no longer set from AI extraction
          invoice_number: extractedData.invoice_number,
          ai_confidence: extractedData.confidence,
          ai_raw_response: extractedData,
          ai_processed_at: new Date().toISOString(),
          status: 'review',
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
        }
      }

      return new Response(
        JSON.stringify({ success: true, is_receipt: true, data: extractedData, raw_response: content, receiptId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanedContent);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Extract receipt error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
