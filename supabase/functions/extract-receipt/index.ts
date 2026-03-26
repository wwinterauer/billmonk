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
  payment_method: string | null;
  invoice_number: string | null;
  confidence: number;
  // New international VAT fields
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

// Multi-Invoice Check Prompt
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

// Function to estimate page count from PDF
function estimatePdfPageCount(pdfBytes: Uint8Array): number {
  try {
    // Simple heuristic: search for /Type /Page patterns
    const text = new TextDecoder('latin1').decode(pdfBytes);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) {
      return pageMatches.length;
    }
    // Fallback: estimate by file size (rough: ~50KB per page for typical PDFs)
    return Math.max(1, Math.ceil(pdfBytes.length / 50000));
  } catch {
    return 1;
  }
}

// Check for multiple invoices in PDF
async function checkForMultipleInvoices(
  pdfBase64: string,
  mimeType: string,
  pageCount: number,
  apiKey: string
): Promise<MultiInvoiceResult> {
  // Only check if PDF has more than 1 page
  if (pageCount <= 1) {
    return { 
      contains_multiple_invoices: false, 
      confidence: 1.0,
      invoice_count: 1, 
      invoices: [],
      reason: "Einzelseiten-PDF"
    };
  }

  try {
    console.log(`Checking ${pageCount}-page PDF for multiple invoices...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du analysierst PDFs auf mehrere Rechnungen. Antworte nur mit JSON." },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: multiInvoiceCheckPrompt,
              },
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

    // Clean and parse JSON
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
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

serve(async (req) => {
  // Handle CORS preflight requests
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
    const forceExtract = body.forceExtract === true;
    const skipMultiCheck = body.skipMultiCheck === true;
    const expensesOnly = body.expensesOnly === true;
    const extractionKeywords: string[] = Array.isArray(body.extractionKeywords) ? body.extractionKeywords : [];
    const extractionHint: string = typeof body.extractionHint === 'string' ? body.extractionHint.trim() : '';

    // Support both direct image upload and receiptId lookup
    if (body.receiptId) {
      receiptId = body.receiptId;
      console.log(`Processing receipt by ID: ${receiptId}${forceExtract ? ' (forced)' : ''}${skipMultiCheck ? ' (skip multi-check)' : ''}`);

      // Fetch receipt from database
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (receiptError || !receipt) {
        console.error("Receipt not found:", receiptError);
        return new Response(
          JSON.stringify({ success: false, error: "The requested receipt could not be found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      // Convert to base64 - handle large files properly
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Use chunked approach for large files to avoid stack overflow
      const chunkSize = 8192;
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      imageBase64 = btoa(binaryString);
      mimeType = receipt.file_type === 'pdf' ? 'application/pdf' : `image/${receipt.file_type}`;
      
      // For PDFs, we still use application/pdf as mimeType
      const isPdf = receipt.file_name?.endsWith('.pdf') || receipt.file_type === 'application/pdf' || receipt.file_type === 'pdf';
      if (isPdf) {
        mimeType = 'application/pdf';
      }

      console.log(`Downloaded file: ${receipt.file_name}, type: ${mimeType}`);

      // Estimate page count for PDFs
      let pageCount = 1;
      if (isPdf) {
        pageCount = estimatePdfPageCount(uint8Array);
        console.log(`Estimated PDF page count: ${pageCount}`);
        
        // Save page count
        await supabase
          .from('receipts')
          .update({ page_count: pageCount })
          .eq('id', receiptId);
      }

      // Multi-Invoice Check (if not skipped and PDF with > 1 page)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!skipMultiCheck && isPdf && pageCount > 1 && LOVABLE_API_KEY) {
        const multiCheck = await checkForMultipleInvoices(
          imageBase64, 
          mimeType, 
          pageCount, 
          LOVABLE_API_KEY
        );

        if (multiCheck.contains_multiple_invoices && 
            multiCheck.confidence >= 0.7 && 
            multiCheck.invoice_count >= 2) {
          console.log(`Multiple invoices detected: ${multiCheck.invoice_count}`);

          // Set status to "needs_splitting"
          await supabase
            .from('receipts')
            .update({
              status: 'needs_splitting',
              split_suggestion: multiCheck,
              notes: `${multiCheck.invoice_count} separate Rechnungen erkannt. Bitte aufteilen.`,
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', receiptId);

          return new Response(
            JSON.stringify({
              success: true,
              needs_splitting: true,
              invoice_count: multiCheck.invoice_count,
              suggestion: multiCheck,
              receiptId: receiptId,
            }),
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

    console.log("Calling Lovable AI Gateway for receipt extraction...");

    const systemPrompt = `Du bist ein Experte für die Analyse von Dokumenten und Rechnungen. 
Analysiere das Dokument und entscheide zuerst, ob es sich um einen Finanzbeleg handelt.
Antworte IMMER und AUSSCHLIESSLICH mit validem JSON ohne zusätzliche Erklärungen oder Markdown.`;

    // Build expenses-only prompt addition if needed
    let expensesOnlyPrompt = '';
    
    // Check if vendor has expenses_only_extraction flag and/or extraction_keywords
    if (receiptId && !expensesOnly) {
      const { data: receiptCheck } = await supabase
        .from('receipts')
        .select('vendor_id, user_id')
        .eq('id', receiptId)
        .single();
      
      if (receiptCheck?.vendor_id) {
        const { data: vendorCheck } = await supabase
          .from('vendors')
          .select('expenses_only_extraction, extraction_keywords, extraction_hint')
          .eq('id', receiptCheck.vendor_id)
          .single();
        
        if (vendorCheck?.expenses_only_extraction) {
          const vendorKeywords: string[] = vendorCheck.extraction_keywords || [];
          const allKeywords = [...new Set([...extractionKeywords, ...vendorKeywords])];
          
          if (allKeywords.length > 0) {
            const keywordList = allKeywords.map(k => `- "${k}"`).join('\n');
            expensesOnlyPrompt = `

WICHTIGE REGEL - GEZIELTE POSITIONS-EXTRAKTION:
Dieser Lieferant hat spezifische Kosten-Positionen.
Suche NUR nach Zeilen/Positionen die eines der folgenden Schlagwoerter im Text enthalten:
${keywordList}

STRENGE FILTERREGEL:
- Eine Zeile wird NUR erfasst, wenn ihr Text eines der obigen Schlagwoerter woertlich enthaelt
- Wenn eine Zeile KEINES dieser Schlagwoerter enthaelt, wird sie KOMPLETT IGNORIERT - auch wenn sie wie eine Ausgabe/Kosten aussieht
- Beispiel: Wenn "Transaktionsgebuehr" ein Schlagwort ist, aber "Ladevorgaenge" NICHT, dann wird "Ladevorgaenge" ignoriert
- Es zaehlen NUR exakte Treffer auf die Schlagwoerter - keine aehnlichen Begriffe, keine Synonyme

FÜR JEDE gefundene Position:
- Erfasse den Bruttobetrag, Nettobetrag, MwSt-Satz und MwSt-Betrag
- Ein Schlagwort kann MEHRFACH auf der Rechnung vorkommen - erfasse JEDE passende Zeile einzeln
- amount_gross = Summe ALLER gefundenen Positionen (Brutto)
- amount_net = Summe ALLER gefundenen Positionen (Netto)
- vat_amount = Summe ALLER Steuerbeträge
- Wenn verschiedene MwSt-Sätze bei den gefundenen Positionen: is_mixed_tax_rate = true und tax_rate_details ausfüllen
- description: Gefundene Positionen mit Beträgen auflisten

WICHTIG - DUPLIKAT-VERMEIDUNG:
- Zähle jede Zeile auf der Rechnung genau EINMAL
- Wenn der gleiche Betrag mehrfach in einer Zusammenfassung/Summenzeile wiederholt wird, erfasse nur die Einzelposition, NICHT die Summenzeile
- Orientiere dich an den tatsächlichen Einzelposten/Detailzeilen, nicht an Zwischensummen oder Gesamtsummen die diese Positionen enthalten

BETRAGS-REGELN:
- Alle Betraege MUESSEN POSITIV sein - es gibt keine negativen Ausgaben
- Wenn ein Betrag in Klammern steht z.B. (0,51) oder ein Minus hat z.B. -0,51, behandle ihn als POSITIVEN Kostenbetrag (also 0,51)
- Ignoriere Gutschriften, Auszahlungen und Erstattungen komplett

IGNORIERE alle anderen Zeilen/Positionen komplett (Einnahmen, Erlöse, Gutschriften, Auszahlungen, Umsätze).`;
          } else {
            expensesOnlyPrompt = `

WICHTIGE REGEL - NUR AUSGABEN EXTRAHIEREN:
Diese Rechnung stammt von einem Lieferanten mit gemischten Abrechnungen (z.B. Plattform-Abrechnung).
- Erfasse NUR AUSGABEN/KOSTEN (Gebühren, Abos, Transaktionskosten, Servicegebühren)
- IGNORIERE Einnahmen, Erlöse, Gutschriften, Auszahlungen, Umsätze
- amount_gross = Summe NUR der Kosten-Positionen
- amount_net und vat_amount ebenfalls nur aus Kosten-Positionen berechnen
- Beschreibung: nur Kosten-Positionen auflisten
- Bei gemischten MwSt-Sätzen der Kosten: is_mixed_tax_rate = true mit Details

BETRAGS-REGELN:
- Alle Betraege MUESSEN POSITIV sein - es gibt keine negativen Ausgaben
- Wenn ein Betrag in Klammern steht z.B. (0,51) oder ein Minus hat z.B. -0,51, behandle ihn als POSITIVEN Kostenbetrag (also 0,51)
- Ignoriere Gutschriften, Auszahlungen und Erstattungen komplett`;
          }
        }
      }
    }
    
    if (expensesOnly && !expensesOnlyPrompt) {
      const allKeywords = [...new Set([...extractionKeywords])];
      
      if (allKeywords.length > 0) {
        const keywordList = allKeywords.map(k => `- "${k}"`).join('\n');
        expensesOnlyPrompt = `

WICHTIGE REGEL - GEZIELTE POSITIONS-EXTRAKTION:
Dieser Lieferant hat spezifische Kosten-Positionen.
Suche NUR nach Zeilen/Positionen die eines der folgenden Schlagwoerter im Text enthalten:
${keywordList}

STRENGE FILTERREGEL:
- Eine Zeile wird NUR erfasst, wenn ihr Text eines der obigen Schlagwoerter woertlich enthaelt
- Wenn eine Zeile KEINES dieser Schlagwoerter enthaelt, wird sie KOMPLETT IGNORIERT - auch wenn sie wie eine Ausgabe/Kosten aussieht
- Beispiel: Wenn "Transaktionsgebuehr" ein Schlagwort ist, aber "Ladevorgaenge" NICHT, dann wird "Ladevorgaenge" ignoriert
- Es zaehlen NUR exakte Treffer auf die Schlagwoerter - keine aehnlichen Begriffe, keine Synonyme

FÜR JEDE gefundene Position:
- Erfasse den Bruttobetrag, Nettobetrag, MwSt-Satz und MwSt-Betrag
- Ein Schlagwort kann MEHRFACH auf der Rechnung vorkommen - erfasse JEDE passende Zeile einzeln
- amount_gross = Summe ALLER gefundenen Positionen (Brutto)
- amount_net = Summe ALLER gefundenen Positionen (Netto)
- vat_amount = Summe ALLER Steuerbeträge
- Wenn verschiedene MwSt-Sätze bei den gefundenen Positionen: is_mixed_tax_rate = true und tax_rate_details ausfüllen
- description: Gefundene Positionen mit Beträgen auflisten

WICHTIG - DUPLIKAT-VERMEIDUNG:
- Zähle jede Zeile auf der Rechnung genau EINMAL
- Wenn der gleiche Betrag mehrfach in einer Zusammenfassung/Summenzeile wiederholt wird, erfasse nur die Einzelposition, NICHT die Summenzeile
- Orientiere dich an den tatsächlichen Einzelposten/Detailzeilen, nicht an Zwischensummen oder Gesamtsummen die diese Positionen enthalten

BETRAGS-REGELN:
- Alle Betraege MUESSEN POSITIV sein - es gibt keine negativen Ausgaben
- Wenn ein Betrag in Klammern steht z.B. (0,51) oder ein Minus hat z.B. -0,51, behandle ihn als POSITIVEN Kostenbetrag (also 0,51)
- Ignoriere Gutschriften, Auszahlungen und Erstattungen komplett

IGNORIERE alle anderen Zeilen/Positionen komplett (Einnahmen, Erlöse, Gutschriften, Auszahlungen, Umsätze).`;
      } else {
        expensesOnlyPrompt = `

WICHTIGE REGEL - NUR AUSGABEN EXTRAHIEREN:
Diese Rechnung stammt von einem Lieferanten mit gemischten Abrechnungen (z.B. Plattform-Abrechnung).
- Erfasse NUR AUSGABEN/KOSTEN (Gebühren, Abos, Transaktionskosten, Servicegebühren)
- IGNORIERE Einnahmen, Erlöse, Gutschriften, Auszahlungen, Umsätze
- amount_gross = Summe NUR der Kosten-Positionen
- amount_net und vat_amount ebenfalls nur aus Kosten-Positionen berechnen
- Beschreibung: nur Kosten-Positionen auflisten
- Bei gemischten MwSt-Sätzen der Kosten: is_mixed_tax_rate = true mit Details

BETRAGS-REGELN:
- Alle Betraege MUESSEN POSITIV sein - es gibt keine negativen Ausgaben
- Wenn ein Betrag in Klammern steht z.B. (0,51) oder ein Minus hat z.B. -0,51, behandle ihn als POSITIVEN Kostenbetrag (also 0,51)
- Ignoriere Gutschriften, Auszahlungen und Erstattungen komplett`;
      }
    }

    // Build extraction hint block
    // Priority: body extractionHint > vendor extraction_hint from DB
    let hintText = extractionHint;
    if (!hintText && receiptId) {
      // Try to load from vendor if not provided in body
      const { data: receiptForHint } = await supabase
        .from('receipts')
        .select('vendor_id')
        .eq('id', receiptId)
        .single();
      
      if (receiptForHint?.vendor_id) {
        const { data: vendorHint } = await supabase
          .from('vendors')
          .select('extraction_hint')
          .eq('id', receiptForHint.vendor_id)
          .single();
        
        if (vendorHint?.extraction_hint) {
          hintText = vendorHint.extraction_hint;
        }
      }
    }

    let extractionHintPrompt = '';
    if (hintText) {
      extractionHintPrompt = `

LIEFERANTEN-SPEZIFISCHER HINWEIS:
${hintText}`;
    }

    console.log(`Expenses-only mode: ${expensesOnlyPrompt ? 'ACTIVE' : 'inactive'} (flag: ${expensesOnly}, keywords: ${extractionKeywords.length}, hint: ${hintText ? 'yes' : 'no'})`);

    // Fetch user's categories for intelligent category matching
    let categoryList = 'Büromaterial, Software & Lizenzen, Reisekosten, Bewirtung, Telefon & Internet, Versicherungen, Miete & Betriebskosten, Fahrzeugkosten, Werbung & Marketing, Sonstiges';
    
    // Determine user_id: from receipt lookup or from auth header
    let userId: string | null = null;
    if (receiptId) {
      const { data: receiptUser } = await supabase
        .from('receipts')
        .select('user_id')
        .eq('id', receiptId)
        .single();
      userId = receiptUser?.user_id || null;
    }
    if (!userId) {
      // Try from auth header
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
      }
    }
    
    if (userId) {
      const { data: userCategories } = await supabase
        .from('categories')
        .select('name')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .eq('is_hidden', false)
        .order('sort_order');
      
      if (userCategories && userCategories.length > 0) {
        const catNames = userCategories.map(c => c.name).filter(n => n !== 'Keine Rechnung');
        if (catNames.length > 0) {
          categoryList = catNames.join(', ');
          console.log(`Using ${catNames.length} user categories for AI matching`);
        }
      }
    }

    const userPrompt = `Analysiere dieses Dokument in zwei Schritten:

SCHRITT 1: DOKUMENTEN-TYP ERKENNEN
Prüfe ob dies eine Rechnung, Quittung, Kassenbon, Gutschrift, Lieferschein mit Preisen oder ähnlicher Finanzbeleg ist.

WENN NEIN (z.B. Foto, Brief, Vertrag ohne Rechnung, Formular, Werbung, Angebot, Bestellung):
Antworte NUR mit:
{
  "is_receipt": false,
  "document_type": "<erkannter Dokumenttyp>",
  "reason": "<kurze Begründung warum es kein Beleg ist>"
}

WENN JA, weiter mit Schritt 2:

SCHRITT 2: BELEG-DATEN EXTRAHIEREN
Extrahiere folgende Informationen im JSON-Format:
{
  "is_receipt": true,
  "vendor": "Offizieller/rechtlicher Firmenname des Lieferanten",
  "vendor_brand": "Markenname falls abweichend vom rechtlichen Namen (sonst null)",
  "description": "Zusammenfassung aller Rechnungspositionen (max 100 Zeichen)",
  "amount_gross": Bruttobetrag als Zahl,
  "amount_net": Nettobetrag als Zahl (falls erkennbar, sonst null),
  "vat_amount": MwSt-Betrag als Zahl (falls erkennbar, sonst null),
  "vat_rate": MwSt-Satz als Zahl (z.B. 20 für 20%),
  "receipt_date": "Datum im Format YYYY-MM-DD",
  "category": "Kategorie: Büromaterial, Software & Lizenzen, Reisekosten, Bewirtung, Telefon & Internet, Versicherungen, Miete & Betriebskosten, Fahrzeugkosten, Werbung & Marketing, Sonstiges",
  "payment_method": "Zahlungsart: Überweisung, Kreditkarte, Bar, PayPal, Lastschrift (sonst null)",
  "invoice_number": "Rechnungsnummer/Belegnummer (suche nach 'Rechnungsnummer:', 'RE-Nr.:', 'Invoice:', etc.)",
  "confidence": Konfidenz von 0.0 bis 1.0
}

WICHTIGE REGELN FÜR LIEFERANT/VENDOR:
- "vendor" = Offizieller/rechtlicher Firmenname MIT Rechtsform. Priorisiere:
  1. HÖCHSTE PRIORITÄT: Impressum/Fußbereich (Firmenbuchnummer, UID, Handelsregister)
  2. MITTLERE PRIORITÄT: Rechnungskopf mit vollständigem Firmennamen
  3. NIEDRIGE PRIORITÄT: Logo-Text
- "vendor_brand" = Markenname wenn abweichend (z.B. Logo: "MediaMarkt" → rechtlich: "Media Markt E-Business GmbH")

**ERKENNBARE RECHTSFORMEN (DACH-Raum & International):**

Österreich:
- GmbH, Gesellschaft mbH, Gesellschaft mit beschränkter Haftung
- AG, Aktiengesellschaft
- OG, Offene Gesellschaft
- KG, Kommanditgesellschaft
- GmbH & Co KG, Gesellschaft mbH & Co KG
- e.U., eingetragener Unternehmer
- GesbR, Gesellschaft bürgerlichen Rechts
- Gen, Genossenschaft
- Verein

Deutschland:
- GmbH, Gesellschaft mit beschränkter Haftung
- AG, Aktiengesellschaft
- UG (haftungsbeschränkt), Unternehmergesellschaft
- OHG, Offene Handelsgesellschaft
- KG, Kommanditgesellschaft
- GmbH & Co. KG
- e.K., eingetragener Kaufmann
- GbR, Gesellschaft bürgerlichen Rechts
- PartG, Partnerschaftsgesellschaft

Schweiz:
- AG, Aktiengesellschaft
- GmbH, Gesellschaft mit beschränkter Haftung
- Sàrl (französisch für GmbH)
- SA (französisch für AG)

International:
- Ltd., Limited
- LLC, Limited Liability Company
- Inc., Incorporated
- S.à r.l., S.A.
- B.V., N.V. (Niederlande)
- S.r.l., S.p.A. (Italien)

**Beispiele für vendor-Feld:**
| Auf der Rechnung | vendor |
|------------------|--------|
| troii Software GmbH | troii Software GmbH |
| Müller Gesellschaft mbH | Müller Gesellschaft mbH |
| Schmidt Gesellschaft mit beschränkter Haftung | Schmidt Gesellschaft mit beschränkter Haftung |
| Weber GmbH & Co KG | Weber GmbH & Co KG |
| Bauer e.U. | Bauer e.U. |
| Amazon EU S.à r.l. | Amazon EU S.à r.l. |
| Apple Distribution International Ltd. | Apple Distribution International Ltd. |

**Wichtig für vendor:**
- Erfasse den Namen MIT der Rechtsform
- Achte auf die korrekte Schreibweise (GmbH vs Gesellschaft mbH)
- Bei mehreren Firmennamen: Nimm den des RECHNUNGSSTELLERS (nicht des Empfängers)
- UID/ATU-Nummer ist NICHT Teil des Firmennamens

WICHTIGE REGELN FÜR BESCHREIBUNG:
- Fasse ALLE Rechnungspositionen zusammen (max 100 Zeichen)
- Trenne mit Komma, keine Preise
- Bei vielen Positionen: wichtigste zuerst, dann "u.a."

WICHTIGE REGELN FÜR STEUER (MwSt./USt.) - GEZIELT NACH % SUCHEN:

1. SUCHE NACH PROZENTZEICHEN (%):
   - Scanne das GESAMTE Dokument nach allen Vorkommen von "%"
   - Typische Muster: "20%", "20,00%", "20.00 %", "20 %"
   - Die Zahl DIREKT VOR dem % ist oft der Steuersatz!

2. KONTEXT PRÜFEN - Diese Begriffe deuten auf MwSt hin:
   - "MwSt", "MwSt.", "Mehrwertsteuer"
   - "USt", "USt.", "Umsatzsteuer" (häufig in Österreich!)
   - "VAT", "Value Added Tax", "TVA"
   - "Steuer", "Tax"
   - "inkl.", "zzgl.", "enthält", "davon"

3. TYPISCHE ZEILEN-MUSTER erkennen:
   - "20% MwSt.: 51,84 EUR" → vat_rate: 20, vat_amount: 51.84
   - "20.00% USt.: € 51.84" → vat_rate: 20, vat_amount: 51.84
   - "inkl. 20% Umsatzsteuer" → vat_rate: 20
   - "inkl. 20 % MwSt." → vat_rate: 20
   - "davon 20% USt 51,84" → vat_rate: 20, vat_amount: 51.84
   - "Netto 259,20 / 20% / Brutto 311,04" → vat_rate: 20
   - "VAT 19%: €9.50" → vat_rate: 19, vat_amount: 9.50
   - "zzgl. 19% MwSt." → vat_rate: 19

4. SUMMENBLOCK AM ENDE PRÜFEN:
   Suche am Dokumentende nach:
   - "Netto: xxx" / "Summe netto: xxx"
   - "20% MwSt/USt: xxx" ← HIER steht oft der Steuersatz!
   - "Brutto: xxx" / "Gesamtbetrag: xxx"

5. MEHRERE STEUERSÄTZE auf einer Rechnung (z.B. Supermarkt, Amazon):
   
   **WICHTIG: Österreichische Supermarkt-Kassenbons (HOFER, BILLA, SPAR, LIDL, PENNY):**
   Am Ende des Kassenbons steht oft ein MwSt-Block in diesem Format:
   
   MWST.A 10.0%      5.40  Netto 54.00
   MWST.B 20.0%     25.58  Netto 127.91
   
   oder:
   
   A=10.0%   Netto  54.00  Steuer  5.40
   B=20.0%   Netto 127.91  Steuer 25.58
   
   WENN du solche Zeilen siehst → is_mixed_tax_rate = true!
   
   **Weitere Erkennungs-Muster für gemischte Steuersätze:**
   - "10% MwSt: 5,00 / 20% MwSt: 12,00"
   - "Summe 7%: ... / Summe 19%: ..."
   - "A = 20%, B = 10%" oder "MWST.A ... MWST.B ..."
   - Mehrere Zeilen mit unterschiedlichen %-Angaben im Summenblock
   - Bei Produkten: Buchstaben-Kennzeichen wie "A", "B" neben Preisen
   
   **PRÜFUNG: Scanne den MwSt/Summenblock am Ende des Belegs:**
   - Wenn dort MEHRERE Prozentsätze aufgelistet sind → gemischte Steuersätze!
   - Beispiel HOFER: "MWST.A 10.0% ... MWST.B 20.0% ..." → is_mixed_tax_rate = true
   
   **Vorgehen bei MEHREREN Steuersätzen:**
   - Setze is_mixed_tax_rate = true
   - Setze vat_rate = null (da nicht eindeutig)
   - Erfasse GESAMT-Brutto (amount_gross), GESAMT-Netto (amount_net), GESAMT-Steuer (vat_amount)
   - Berechne: amount_net = Summe aller Netto-Beträge, vat_amount = Summe aller Steuerbeträge
   - Speichere Details in tax_rate_details:
     [{"rate": 10, "net_amount": 54.00, "tax_amount": 5.40, "description": "Ermäßigt (10%)"},
      {"rate": 20, "net_amount": 127.91, "tax_amount": 25.58, "description": "Normal (20%)"}]
   
   **Bei NUR EINEM Steuersatz:**
   - Setze is_mixed_tax_rate = false
   - Setze vat_rate = der erkannte Satz (z.B. 20)
   - tax_rate_details = null

6. VALIDIERUNG - Übliche Steuersätze nach Land:
   - Österreich (AT): 0%, 10%, 13%, 20%
   - Deutschland (DE): 0%, 7%, 19%
   - Schweiz (CH): 0%, 2.6%, 3.8%, 8.1% (seit 2024)
   - Italien (IT): 0%, 4%, 5%, 10%, 22%
   - Frankreich (FR): 0%, 2.1%, 5.5%, 10%, 20%
   - Niederlande (NL): 0%, 9%, 21%
   - Spanien (ES): 0%, 4%, 10%, 21%
   - Falls unüblicher Wert (z.B. 25%, 15%): nochmal prüfen!

7. BERECHNUNG ZUR KONTROLLE (wenn Netto+Brutto vorhanden):
   - Formel: ((Brutto / Netto) - 1) * 100 = Steuersatz
   - Beispiel: Brutto 311,04€, Netto 259,20€ → (311.04/259.20 - 1) * 100 = 20%
   - Nutze dies zur Validierung des gefundenen Satzes

**ERWEITERT: Länder-Erkennung und internationale MwSt**

Schritt A: LAND DES RECHNUNGSSTELLERS ERKENNEN
Erkenne das Land aus:
- UID-Nummer Format: ATU=Österreich, DE=Deutschland, CHE=Schweiz, IT=Italien, FR=Frankreich
- Adresse im Briefkopf (PLZ, Stadt, Land)
- Währung (CHF → Schweiz)
- Sprache und Begriffe

Setze vendor_country als ISO-2-Code: AT, DE, CH, IT, FR, NL, ES, etc.

Schritt B: 0% STEUERSATZ ERKENNEN
**WICHTIG: 0% ist ein GÜLTIGER Steuersatz!**
Wenn auf der Rechnung explizit steht:
- "0% USt", "0,00% USt", "0.00% USt", "0% MwSt", "0,00% MwSt"
- "USt 0%", "MwSt 0%", "VAT 0%"
- "Steuersatz: 0%", "Steuersatz: 0.00%"
- "USt.-Betrag: 0,00" oder "MwSt: € 0,00" (mit Steuersatz 0%)

Dann setze:
- vat_rate: 0 (NICHT null!)
- vat_amount: 0
- amount_net = amount_gross (da keine Steuer)

Schritt C: SONDERFÄLLE ERKENNEN
Setze special_vat_case NUR wenn einer dieser EXPLIZITEN Hinweise gefunden wird:
- "Kleinunternehmer gemäß § 6 UStG" (AT) → special_vat_case: "kleinunternehmer", vat_rate: 0
- "Kleinunternehmerregelung § 19 UStG" (DE) → special_vat_case: "kleinunternehmer", vat_rate: 0
- "Reverse Charge" / "Steuerschuldnerschaft" → special_vat_case: "reverse_charge", vat_rate: 0
- "Innergemeinschaftliche Lieferung" / "innergemeinschaftl. Lieferung" → special_vat_case: "ig_lieferung", vat_rate: 0
- "Steuerfreie Ausfuhrlieferung" / "Ausfuhr" → special_vat_case: "export", vat_rate: 0
- "Differenzbesteuerung" / "§ 25a UStG" → special_vat_case: null, vat_rate: 0 (Gebrauchtwarenhandel)

**WENN 0% USt EXPLIZIT STEHT ABER KEIN SONDERFALL-HINWEIS:**
- Setze vat_rate: 0, vat_amount: 0
- Setze special_vat_case: null (kein Sonderfall erkennbar)
- Dies ist trotzdem ein gültiger 0%-Beleg!

Schritt C: VAT KONFIDENZ BEWERTEN
Setze vat_confidence (0.00 - 1.00):
- 0.95-1.00: MwSt explizit angegeben UND Berechnung stimmt (Brutto = Netto + MwSt)
- 0.80-0.94: MwSt explizit angegeben ODER aus Berechnung eindeutig
- 0.50-0.79: MwSt aus Kontext abgeleitet, nicht explizit
- 0.20-0.49: MwSt geschätzt basierend auf Land/Branche
- 0.00-0.19: Keine MwSt-Information gefunden

Setze vat_detection_method:
- "explicit": MwSt-Satz stand explizit auf der Rechnung
- "calculated": Aus Brutto/Netto-Differenz berechnet
- "estimated": Geschätzt basierend auf Land/Kontext

WEITERE REGELN:
- Antworte NUR mit JSON, keine Markdown-Codeblöcke
- Unerkennbare Felder auf null setzen
- Beträge als Dezimalzahlen ohne Währungssymbol
- Datum im Format YYYY-MM-DD

**JSON-Ausgabeformat:**
{
  "is_receipt": true,
  "vendor": "...",
  "vendor_brand": "..." oder null,
  "description": "...",
  "amount_gross": 150.00,
  "amount_net": 132.50,
  "vat_amount": 17.50,
  "vat_rate": 20 oder null (bei gemischt),
  "is_mixed_tax_rate": false oder true,
  "tax_rate_details": null oder [...],
  "receipt_date": "YYYY-MM-DD",
  "category": "...",
  "payment_method": "...",
  "invoice_number": "...",
  "confidence": 0.95,
  "vendor_country": "AT",
  "vat_confidence": 0.92,
  "vat_detection_method": "explicit",
  "special_vat_case": null
}

Beispiel Kleinunternehmer:
{
  "vat_rate": 0,
  "vendor_country": "AT",
  "vat_confidence": 0.95,
  "vat_detection_method": "explicit",
  "special_vat_case": "kleinunternehmer"
}`;

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
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: userPrompt + expensesOnlyPrompt + extractionHintPrompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
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

    const aiResponse = await response.json();
    console.log("AI Response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in AI response:", aiResponse);
      return new Response(
        JSON.stringify({ success: false, error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    try {
      const extractedData: ExtractionResult = JSON.parse(cleanedContent);

      // Post-Processing: Ensure all amounts are positive (no negative expenses)
      if (extractedData.amount_gross != null && extractedData.amount_gross < 0) {
        console.log(`[Amount Fix] amount_gross ${extractedData.amount_gross} → ${Math.abs(extractedData.amount_gross)}`);
        extractedData.amount_gross = Math.abs(extractedData.amount_gross);
      }
      if (extractedData.amount_net != null && extractedData.amount_net < 0) {
        extractedData.amount_net = Math.abs(extractedData.amount_net);
      }
      if (extractedData.vat_amount != null && extractedData.vat_amount < 0) {
        extractedData.vat_amount = Math.abs(extractedData.vat_amount);
      }
      if (extractedData.tax_rate_details && Array.isArray(extractedData.tax_rate_details)) {
        extractedData.tax_rate_details = extractedData.tax_rate_details.map(detail => ({
          ...detail,
          net_amount: Math.abs(detail.net_amount),
          tax_amount: Math.abs(detail.tax_amount),
        }));
      }

      // === POST-PROCESSING: MwSt-Konsistenzprüfung ===
      if (extractedData.amount_gross != null) {
        // Regel 0: Explizite 0% USt. im Dokument-Text respektieren
        const zeroVatPattern = /0[,.]?0{0,2}\s*%\s*(USt|MwSt|Ust|mwst|umsatzsteuer)/i;
        if (zeroVatPattern.test(content) && extractedData.vat_rate !== 0) {
          console.log(`[VAT Consistency] Rule 0: Explicit 0% USt found in document text, correcting vat_rate from ${extractedData.vat_rate}% to 0%`);
          extractedData.vat_rate = 0;
          extractedData.vat_amount = 0;
          extractedData.amount_net = extractedData.amount_gross;
        }

        // Regel 1: Brutto == Netto und kein MwSt-Betrag → Satz muss 0 sein
        if (extractedData.amount_gross === extractedData.amount_net && (!extractedData.vat_amount || extractedData.vat_amount === 0)) {
          if (extractedData.vat_rate && extractedData.vat_rate > 0) {
            console.log(`[VAT Consistency] Rule 1: Gross=Net and no VAT amount, correcting vat_rate from ${extractedData.vat_rate}% to 0%`);
          }
          extractedData.vat_rate = 0;
          extractedData.vat_amount = 0;
        }

        // Regel 2: Satz > 0 mit MwSt-Betrag, aber Netto fehlt oder gleich Brutto
        if (extractedData.vat_rate != null && extractedData.vat_rate > 0 && extractedData.vat_amount != null && extractedData.vat_amount > 0
            && (!extractedData.amount_net || extractedData.amount_net === extractedData.amount_gross)) {
          extractedData.amount_net = Math.round((extractedData.amount_gross - extractedData.vat_amount) * 100) / 100;
          console.log(`[VAT Consistency] Rule 2: Net calculated from Gross-VAT: ${extractedData.amount_net}`);
        }

        // Regel 3: Satz > 0, aber MwSt-Betrag fehlt und Netto fehlt/gleich Brutto
        if (extractedData.vat_rate != null && extractedData.vat_rate > 0
            && (!extractedData.vat_amount || extractedData.vat_amount === 0)
            && (!extractedData.amount_net || extractedData.amount_net === extractedData.amount_gross)) {
          extractedData.amount_net = Math.round((extractedData.amount_gross / (1 + extractedData.vat_rate / 100)) * 100) / 100;
          extractedData.vat_amount = Math.round((extractedData.amount_gross - extractedData.amount_net) * 100) / 100;
          console.log(`[VAT Consistency] Rule 3: Net=${extractedData.amount_net}, VAT=${extractedData.vat_amount} calculated from Gross+Rate`);
        }

        // Regel 4: Netto < Brutto, aber MwSt-Betrag fehlt
        if (extractedData.amount_net != null && extractedData.amount_net < extractedData.amount_gross
            && (!extractedData.vat_amount || extractedData.vat_amount === 0)) {
          extractedData.vat_amount = Math.round((extractedData.amount_gross - extractedData.amount_net) * 100) / 100;
          console.log(`[VAT Consistency] Rule 4: VAT amount=${extractedData.vat_amount} from Gross-Net difference`);
        }
      }

      // Check if document is NOT a receipt - save it with "Keine Rechnung" category
      // These can be supplementary documents (detail pages, attachments, etc.)
      if (extractedData.is_receipt === false) {
        console.log("Document is NOT a receipt - saving as supplementary document:", {
          document_type: extractedData.document_type,
          reason: extractedData.reason,
        });

        // Save as normal document with "Keine Rechnung" category instead of rejecting
        if (receiptId) {
          const documentDescription = extractedData.document_type 
            ? `${extractedData.document_type}${extractedData.reason ? `: ${extractedData.reason}` : ''}`
            : 'Kein Rechnungsdokument';

          const { error: updateError } = await supabase
            .from('receipts')
            .update({
              status: 'review', // Set to review so user can process it
              category: 'Keine Rechnung', // Special category for non-receipt documents
              description: documentDescription.substring(0, 100), // Truncate to max length
              ai_confidence: 0.5, // Medium confidence as it's a valid document, just not a receipt
              notes: `Dokumenttyp: ${extractedData.document_type || 'Unbekannt'}. ${extractedData.reason || 'Kann als Hilfsdokument verwendet werden.'}`,
              ai_raw_response: extractedData,
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', receiptId);

          if (updateError) {
            console.error("Failed to update receipt:", updateError);
          } else {
            console.log(`Receipt ${receiptId} saved with category 'Keine Rechnung' for review`);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            is_receipt: false,
            saved_as_supplementary: true,
            document_type: extractedData.document_type,
            reason: extractedData.reason,
            receiptId: receiptId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Document IS a receipt - proceed with normal extraction
      console.log("Successfully extracted receipt data:", {
        vendor: extractedData.vendor,
        vendor_brand: extractedData.vendor_brand,
        amount_gross: extractedData.amount_gross,
        invoice_number: extractedData.invoice_number,
        confidence: extractedData.confidence,
      });

      // If receiptId was provided, update the receipt in database
      if (receiptId) {
        // Check for learned VAT rate
        let finalVatRate = extractedData.vat_rate;
        let vatRateSource: 'ai' | 'learned' = 'ai';

        // First get the receipt to find user_id and vendor_id
        const { data: receiptInfo } = await supabase
          .from('receipts')
          .select('user_id, vendor_id')
          .eq('id', receiptId)
          .single();

        if (receiptInfo?.user_id && extractedData.vendor) {
          // Try to find vendor by name for VAT learning
          const { data: vendorMatch } = await supabase
            .from('vendors')
            .select('id, expenses_only_extraction, legal_names')
            .eq('user_id', receiptInfo.user_id)
            .or(`display_name.ilike.${extractedData.vendor}`)
            .maybeSingle();

          // If no match by display_name, check legal_names arrays
          let finalVendorMatch = vendorMatch;
          if (!finalVendorMatch) {
            const { data: allVendors } = await supabase
              .from('vendors')
              .select('id, expenses_only_extraction, legal_names')
              .eq('user_id', receiptInfo.user_id);
            
            if (allVendors) {
              finalVendorMatch = allVendors.find(v => 
                (v.legal_names || []).some((ln: string) => 
                  ln.toLowerCase() === extractedData.vendor.toLowerCase()
                )
              ) || null;
            }
          }

          const vendorId = receiptInfo.vendor_id || finalVendorMatch?.id;
          const _vendorExpensesOnly = finalVendorMatch?.expenses_only_extraction === true;

          if (vendorId) {
            // Check for learned VAT rate
            const { data: learning } = await supabase
              .from('vendor_learning')
              .select('default_vat_rate, vat_rate_confidence, vat_rate_corrections')
              .eq('vendor_id', vendorId)
              .eq('user_id', receiptInfo.user_id)
              .eq('is_active', true)
              .maybeSingle();

            // Use learned rate if confidence >= 70% or at least 3 corrections
            if (learning?.default_vat_rate !== null && learning?.default_vat_rate !== undefined) {
              const shouldUseLearned = 
                (learning.vat_rate_confidence ?? 0) >= 70 || 
                (learning.vat_rate_corrections ?? 0) >= 3;

              if (shouldUseLearned) {
                console.log(`[VAT Learning] Using learned rate ${learning.default_vat_rate}% for vendor (AI: ${extractedData.vat_rate}%, confidence: ${learning.vat_rate_confidence}%)`);
                finalVatRate = Number(learning.default_vat_rate);
                vatRateSource = 'learned';
              }
            }
          }
        }

        const { error: updateError } = await supabase
          .from('receipts')
          .update({
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
            category: extractedData.category,
            payment_method: extractedData.payment_method,
            invoice_number: extractedData.invoice_number,
            ai_confidence: extractedData.confidence,
            ai_raw_response: extractedData,
            ai_processed_at: new Date().toISOString(),
            status: 'review',
            // New international VAT fields
            vendor_country: extractedData.vendor_country || null,
            vat_confidence: vatRateSource === 'learned' ? 1.0 : (extractedData.vat_confidence || null),
            vat_detection_method: vatRateSource === 'learned' ? 'learned' : (extractedData.vat_detection_method || null),
            special_vat_case: extractedData.special_vat_case || null,
          })
          .eq('id', receiptId);

        if (updateError) {
          console.error("Failed to update receipt:", updateError);
        } else {
          console.log(`Receipt ${receiptId} updated with extracted data (VAT source: ${vatRateSource}), status set to 'review'`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          is_receipt: true,
          data: extractedData,
          raw_response: content,
          receiptId: receiptId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedContent);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to parse AI response", 
          raw: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Extract receipt error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
