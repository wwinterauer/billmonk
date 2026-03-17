import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("user_id", userId)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoice_id)
      .order("position");

    // Fetch customer
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .single();

    // Fetch settings
    const { data: settings } = await supabase
      .from("invoice_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Fetch profile for sender info
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, first_name, last_name, street, zip, city, country, uid_number")
      .eq("id", userId)
      .single();

    // Build PDF using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import("npm:pdf-lib@1.17.1");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const { height } = page.getSize();
    const margin = 50;

    let y = height - margin;

    const drawText = (text: string, x: number, yPos: number, options: any = {}) => {
      page.drawText(text || "", {
        x,
        y: yPos,
        size: options.size || fontSize,
        font: options.bold ? fontBold : font,
        color: options.color || rgb(0, 0, 0),
      });
    };

    const fmtNum = (n: number) =>
      new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const fmtCur = (n: number) => `€ ${fmtNum(n)}`;

    const fmtDate = (d: string | null) => {
      if (!d) return "–";
      return new Date(d).toLocaleDateString("de-AT");
    };

    // --- HEADER: Sender ---
    const senderName = profile?.company_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "–";
    drawText(senderName, margin, y, { size: 14, bold: true });
    y -= 14;
    if (profile?.street) { drawText(profile.street, margin, y); y -= 12; }
    if (profile?.zip || profile?.city) {
      drawText(`${profile?.zip || ""} ${profile?.city || ""}`.trim(), margin, y);
      y -= 12;
    }
    if (profile?.uid_number) { drawText(`UID: ${profile.uid_number}`, margin, y); y -= 12; }
    y -= 10;

    // --- RECIPIENT ---
    drawText("An:", margin, y, { color: rgb(0.4, 0.4, 0.4), size: 8 });
    y -= 14;
    if (customer) {
      drawText(customer.display_name, margin, y, { bold: true });
      y -= 12;
      if (customer.company_name && customer.company_name !== customer.display_name) {
        drawText(customer.company_name, margin, y); y -= 12;
      }
      if (customer.street) { drawText(customer.street, margin, y); y -= 12; }
      if (customer.zip || customer.city) {
        drawText(`${customer.zip || ""} ${customer.city || ""}`.trim(), margin, y);
        y -= 12;
      }
      if (customer.uid_number) { drawText(`UID: ${customer.uid_number}`, margin, y); y -= 12; }
    }
    y -= 20;

    // --- INVOICE TITLE ---
    drawText(`Rechnung ${invoice.invoice_number}`, margin, y, { size: 16, bold: true });
    y -= 20;

    // Meta info right-aligned
    const metaX = 380;
    drawText("Rechnungsdatum:", metaX, y + 20); drawText(fmtDate(invoice.invoice_date), metaX + 100, y + 20);
    drawText("Fälligkeitsdatum:", metaX, y + 8); drawText(fmtDate(invoice.due_date), metaX + 100, y + 8);
    if (invoice.payment_reference) {
      drawText("Zahlungsreferenz:", metaX, y - 4); drawText(invoice.payment_reference, metaX + 100, y - 4);
    }
    y -= 10;

    // --- LINE ITEMS TABLE ---
    // Header
    const colX = { pos: margin, desc: margin + 25, qty: 310, unit: 355, price: 400, vat: 455, total: 500 };
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;
    drawText("Pos", colX.pos, y, { bold: true, size: 8 });
    drawText("Beschreibung", colX.desc, y, { bold: true, size: 8 });
    drawText("Menge", colX.qty, y, { bold: true, size: 8 });
    drawText("Einheit", colX.unit, y, { bold: true, size: 8 });
    drawText("Preis", colX.price, y, { bold: true, size: 8 });
    drawText("MwSt", colX.vat, y, { bold: true, size: 8 });
    drawText("Netto", colX.total, y, { bold: true, size: 8 });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;

    const items = lineItems || [];
    for (const item of items) {
      const lineNet = (item.quantity || 1) * (item.unit_price || 0);
      const desc = (item.description || "").substring(0, 45);
      drawText(String(item.position || ""), colX.pos, y, { size: 8 });
      drawText(desc, colX.desc, y, { size: 8 });
      drawText(fmtNum(item.quantity || 1), colX.qty, y, { size: 8 });
      drawText(item.unit || "Stk", colX.unit, y, { size: 8 });
      drawText(fmtNum(item.unit_price || 0), colX.price, y, { size: 8 });
      drawText(`${fmtNum(item.vat_rate || 0)} %`, colX.vat, y, { size: 8 });
      drawText(fmtNum(lineNet), colX.total, y, { size: 8 });
      y -= 14;

      if (y < 120) break; // Safety: don't go off page
    }

    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;

    // --- TOTALS ---
    const totalsX = 400;
    drawText("Netto:", totalsX, y); drawText(fmtCur(invoice.subtotal || 0), 490, y);
    y -= 14;

    // VAT groups
    const vatGroups: Record<number, number> = {};
    for (const item of items) {
      const lineNet = (item.quantity || 1) * (item.unit_price || 0);
      const rate = item.vat_rate || 0;
      vatGroups[rate] = (vatGroups[rate] || 0) + lineNet * (rate / 100);
    }
    for (const [rate, amount] of Object.entries(vatGroups)) {
      drawText(`MwSt ${rate} %:`, totalsX, y); drawText(fmtCur(amount as number), 490, y);
      y -= 14;
    }

    page.drawLine({ start: { x: totalsX, y: y + 4 }, end: { x: 545, y: y + 4 }, thickness: 1, color: rgb(0, 0, 0) });
    drawText("Gesamt:", totalsX, y, { bold: true, size: 11 });
    drawText(fmtCur(invoice.total || 0), 490, y, { bold: true, size: 11 });
    y -= 24;

    // --- NOTES ---
    if (invoice.notes) {
      drawText("Anmerkungen:", margin, y, { bold: true, size: 8 });
      y -= 12;
      drawText(invoice.notes.substring(0, 200), margin, y, { size: 8 });
      y -= 16;
    }

    // --- BANK DETAILS / FOOTER ---
    if (settings?.iban || settings?.bank_name) {
      drawText("Bankverbindung:", margin, y, { bold: true, size: 8 });
      y -= 12;
      if (settings.bank_name) { drawText(settings.bank_name, margin, y, { size: 8 }); y -= 11; }
      if (settings.iban) { drawText(`IBAN: ${settings.iban}`, margin, y, { size: 8 }); y -= 11; }
      if (settings.bic) { drawText(`BIC: ${settings.bic}`, margin, y, { size: 8 }); y -= 11; }
      y -= 8;
    }

    if (invoice.footer_text) {
      drawText(invoice.footer_text.substring(0, 300), margin, y, {
        size: 7,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const storagePath = `${userId}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: uploadErr } = await adminClient.storage
      .from("invoices")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: "PDF upload failed", detail: uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update invoice with PDF path
    await supabase
      .from("invoices")
      .update({ pdf_storage_path: storagePath })
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({ success: true, storage_path: storagePath }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
