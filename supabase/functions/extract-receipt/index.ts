import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  receipt_date: string | null;
  category: string | null;
  payment_method: string | null;
  invoice_number: string | null;
  confidence: number;
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
          JSON.stringify({ success: false, error: "Receipt not found" }),
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
          JSON.stringify({ success: false, error: "Failed to download file" }),
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
- "vendor" = Offizieller/rechtlicher Firmenname. Priorisiere:
  1. HÖCHSTE PRIORITÄT: Impressum/Fußbereich (Firmenbuchnummer, UID, Handelsregister)
  2. MITTLERE PRIORITÄT: Rechnungskopf mit vollständigem Firmennamen
  3. NIEDRIGE PRIORITÄT: Logo-Text
- "vendor_brand" = Markenname wenn abweichend (z.B. Logo: "MediaMarkt" → rechtlich: "Media Markt E-Business GmbH")

WICHTIGE REGELN FÜR BESCHREIBUNG:
- Fasse ALLE Rechnungspositionen zusammen (max 100 Zeichen)
- Trenne mit Komma, keine Preise
- Bei vielen Positionen: wichtigste zuerst, dann "u.a."

WICHTIGE REGELN FÜR STEUER (MwSt./USt.):
- "MwSt." und "USt." sind SYNONYME (Mehrwertsteuer = Umsatzsteuer)
- Suche nach ALLEN folgenden Begriffen: MwSt., USt., Mehrwertsteuer, Umsatzsteuer, VAT, Steuer, Tax
- Österreichische Rechnungen verwenden oft "USt." statt "MwSt."
- Achte auf Zeilen wie:
  - "20% MwSt.: 51,84 EUR" → vat_rate: 20, vat_amount: 51.84
  - "20.00% USt.: 51.84 EUR" → vat_rate: 20, vat_amount: 51.84
  - "inkl. 20% USt." → vat_rate: 20
  - "zzgl. 19% MwSt." → vat_rate: 19
  - "VAT 20%: €51.84" → vat_rate: 20, vat_amount: 51.84
- Übliche Steuersätze:
  - Österreich: 20% (normal), 10%/13% (ermäßigt), 0%
  - Deutschland: 19% (normal), 7% (ermäßigt), 0%

WEITERE REGELN:
- Antworte NUR mit JSON, keine Markdown-Codeblöcke
- Unerkennbare Felder auf null setzen
- Beträge als Dezimalzahlen ohne Währungssymbol
- Datum im Format YYYY-MM-DD`;

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
                text: userPrompt,
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
            .select('id')
            .eq('user_id', receiptInfo.user_id)
            .or(`display_name.ilike.${extractedData.vendor},legal_name.ilike.${extractedData.vendor}`)
            .maybeSingle();

          const vendorId = receiptInfo.vendor_id || vendorMatch?.id;

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
            receipt_date: extractedData.receipt_date,
            category: extractedData.category,
            payment_method: extractedData.payment_method,
            invoice_number: extractedData.invoice_number,
            ai_confidence: extractedData.confidence,
            ai_raw_response: extractedData,
            ai_processed_at: new Date().toISOString(),
            status: 'review',
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
