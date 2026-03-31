import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SplitPart {
  pages: number[];
  vendor_name?: string;
  invoice_number?: string;
  total_amount?: number;
  date?: string;
}

interface SplitRequest {
  receiptId: string;
  splits: SplitPart[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth prüfen
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Nicht authentifiziert");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Ungültiger Token");
    }

    const { receiptId, splits }: SplitRequest = await req.json();

    // Validierung
    if (!receiptId) {
      throw new Error("receiptId ist erforderlich");
    }

    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      throw new Error("Mindestens 2 Splits erforderlich");
    }

    // Prüfe ob alle Splits Seiten haben
    const validSplits = splits.filter(s => s.pages && s.pages.length > 0);
    if (validSplits.length < 2) {
      throw new Error("Mindestens 2 Splits mit Seiten erforderlich");
    }

    console.log(`Splitting PDF ${receiptId} into ${validSplits.length} parts`);

    // Original-Receipt laden
    const { data: originalReceipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (receiptError || !originalReceipt) {
      throw new Error("Receipt nicht gefunden oder keine Berechtigung");
    }

    if (!originalReceipt.file_url) {
      throw new Error("Receipt hat keine Datei");
    }

    // PDF aus Storage laden
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(originalReceipt.file_url);

    if (downloadError || !fileData) {
      throw new Error(`PDF konnte nicht geladen werden: ${downloadError?.message}`);
    }

    const pdfBuffer = await fileData.arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = originalPdf.getPageCount();

    console.log(`Original PDF has ${totalPages} pages`);

    // Validiere alle Seitenzahlen
    for (const split of validSplits) {
      for (const page of split.pages) {
        if (page < 1 || page > totalPages) {
          throw new Error(`Ungültige Seitenzahl: ${page}. PDF hat nur ${totalPages} Seiten.`);
        }
      }
    }

    const createdReceipts: Array<{
      id: string;
      file_name: string;
      pages: number[];
      vendor_name?: string;
    }> = [];

    // Für jeden Split ein neues PDF erstellen
    for (let i = 0; i < validSplits.length; i++) {
      const split = validSplits[i];
      const sortedPages = [...split.pages].sort((a, b) => a - b);

      console.log(`Creating split ${i + 1}: pages ${sortedPages.join(', ')}`);

      try {
        // Neues PDF erstellen
        const newPdf = await PDFDocument.create();

        // Seiten kopieren (pdf-lib ist 0-indexed, unsere Eingabe ist 1-indexed)
        const pageIndices = sortedPages.map(p => p - 1);
        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);

        for (const page of copiedPages) {
          newPdf.addPage(page);
        }

        const newPdfBytes = await newPdf.save();

        // Dateiname generieren
        const originalBaseName = (originalReceipt.file_name || 'receipt')
          .replace(/\.pdf$/i, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        
        const vendorSlug = split.vendor_name
          ? `_${split.vendor_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`
          : '';
        
        const partName = `${originalBaseName}${vendorSlug}_Teil${i + 1}.pdf`;

        // Storage-Pfad generieren
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const uuid = crypto.randomUUID();
        const storagePath = `${user.id}/${year}/${month}/${uuid}_${partName}`;

        // Neues PDF hochladen
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(storagePath, newPdfBytes, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload failed for split ${i + 1}:`, uploadError);
          throw new Error(`Upload fehlgeschlagen für Teil ${i + 1}: ${uploadError.message}`);
        }

        // File-Hash berechnen
        const hashBuffer = await crypto.subtle.digest('SHA-256', newPdfBytes.buffer as ArrayBuffer);
        const fileHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Neuen Receipt erstellen
        const { data: newReceipt, error: insertError } = await supabase
          .from('receipts')
          .insert({
            user_id: user.id,
            file_url: storagePath,
            file_name: partName,
            file_type: 'application/pdf',
            file_hash: fileHash,
            status: 'processing',
            source: 'split',
            split_from_receipt_id: receiptId,
            original_pages: sortedPages,
            page_count: sortedPages.length,
            // Übernehme vorgeschlagene Werte wenn vorhanden
            vendor: split.vendor_name || null,
            amount_gross: split.total_amount || null,
            receipt_date: split.date || null,
            invoice_number: split.invoice_number || null,
          })
          .select('id, file_name')
          .single();

        if (insertError) {
          console.error(`Insert failed for split ${i + 1}:`, insertError);
          throw new Error(`Receipt erstellen fehlgeschlagen für Teil ${i + 1}: ${insertError.message}`);
        }

        createdReceipts.push({
          id: newReceipt.id,
          file_name: newReceipt.file_name,
          pages: sortedPages,
          vendor_name: split.vendor_name,
        });

        console.log(`Created split receipt ${newReceipt.id}: ${partName}`);

        // Extraction will be triggered in background after response

      } catch (splitError: any) {
        console.error(`Error processing split ${i + 1}:`, splitError);
        throw splitError;
      }
    }

    // Prüfe ob mindestens ein Split erfolgreich war
    if (createdReceipts.length === 0) {
      throw new Error("Keine Splits konnten erstellt werden");
    }

    // Original-Receipt als "split" markieren
    await supabase
      .from('receipts')
      .update({
        status: 'split',
        notes: `Aufgeteilt in ${createdReceipts.length} Teile: ${createdReceipts.map(r => r.file_name).join(', ')}`,
        split_suggestion: null,
      })
      .eq('id', receiptId);

    console.log(`Split complete: ${createdReceipts.length} receipts created from ${receiptId}`);

    // Background extraction with retry — runs after response is sent
    (async () => {
      const extractWithRetry = async (receiptId: string) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const { error } = await supabase.functions.invoke('extract-receipt', {
              body: { receiptId, skipMultiCheck: true }
            });
            if (error) throw error;
            console.log(`Extraction succeeded for ${receiptId} (attempt ${attempt})`);
            return;
          } catch (err) {
            console.error(`Extraction attempt ${attempt} failed for ${receiptId}:`, err);
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
        // Both attempts failed — mark as error
        await supabase.from('receipts').update({
          status: 'error',
          notes: 'KI-Extraktion nach 2 Versuchen fehlgeschlagen',
        }).eq('id', receiptId);
        console.error(`Marked ${receiptId} as error after 2 failed extraction attempts`);
      };

      for (const r of createdReceipts) {
        await extractWithRetry(r.id);
      }
    })();

    return new Response(
      JSON.stringify({
        success: true,
        originalReceiptId: receiptId,
        createdReceipts,
        count: createdReceipts.length,
        message: `PDF erfolgreich in ${createdReceipts.length} Teile aufgeteilt`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Split PDF Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
