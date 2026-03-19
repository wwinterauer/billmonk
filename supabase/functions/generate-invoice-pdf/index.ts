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

    // Fetch invoice settings
    const { data: settings } = await supabase
      .from("invoice_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Fetch company settings (new)
    const { data: company } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const isSmallBusiness = company?.is_small_business || false;
    const documentType = invoice.document_type || "invoice";
    const layoutVariant = settings?.layout_variant || "classic";
    const isDeliveryNote = documentType === "delivery_note";
    const invoiceSubtype = invoice.invoice_subtype || "normal";

    // Document title based on type
    const docTitleMap: Record<string, string> = {
      quote: "Angebot",
      order_confirmation: "Auftragsbestätigung",
      invoice: "Rechnung",
      credit_note: "Gutschrift",
      delivery_note: "Lieferschein",
    };

    // Subtype overrides for invoices
    const subtypeTitleMap: Record<string, string> = {
      deposit: "Anzahlungsrechnung",
      partial: "Teilrechnung",
      final: "Schlussrechnung",
    };

    let docTitle = docTitleMap[documentType] || "Rechnung";
    if (documentType === "invoice" && invoiceSubtype !== "normal" && subtypeTitleMap[invoiceSubtype]) {
      docTitle = subtypeTitleMap[invoiceSubtype];
    }

    // Fetch related order number for partial invoices
    let relatedOrderNumber: string | null = null;
    if (invoice.related_order_id) {
      const { data: relatedOrder } = await supabase
        .from("invoices")
        .select("invoice_number, document_type")
        .eq("id", invoice.related_order_id)
        .single();
      if (relatedOrder) {
        relatedOrderNumber = relatedOrder.invoice_number;
      }
    }

    // Build PDF using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import("npm:pdf-lib@1.17.1");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const { width, height } = page.getSize();
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

    // --- Try to embed logo ---
    let logoImage: any = null;
    if (company?.logo_path) {
      try {
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: logoData } = await adminClient.storage
          .from("company-logos")
          .download(company.logo_path);
        if (logoData) {
          const logoBytes = new Uint8Array(await logoData.arrayBuffer());
          const isPng = company.logo_path.toLowerCase().endsWith(".png");
          logoImage = isPng
            ? await pdfDoc.embedPng(logoBytes)
            : await pdfDoc.embedJpg(logoBytes);
        }
      } catch (e) {
        console.error("Logo embed error:", e);
      }
    }

    // --- LAYOUT VARIANTS ---
    if (layoutVariant === "modern" && logoImage) {
      // Centered logo
      const logoDims = logoImage.scaleToFit(120, 50);
      page.drawImage(logoImage, {
        x: (width - logoDims.width) / 2,
        y: y - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
      y -= logoDims.height + 20;
    } else if (logoImage && layoutVariant !== "minimal") {
      // Classic: logo top-left
      const logoDims = logoImage.scaleToFit(100, 45);
      page.drawImage(logoImage, {
        x: margin,
        y: y - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
      y -= logoDims.height + 10;
    }

    // --- HEADER: Sender (from company_settings) ---
    const senderName = company?.company_name || "–";
    drawText(senderName, margin, y, { size: 14, bold: true });
    y -= 14;
    if (company?.street) { drawText(company.street, margin, y); y -= 12; }
    if (company?.zip || company?.city) {
      drawText(`${company?.zip || ""} ${company?.city || ""}`.trim(), margin, y);
      y -= 12;
    }
    if (company?.uid_number) { drawText(`UID: ${company.uid_number}`, margin, y); y -= 12; }
    if (company?.company_register_number) {
      drawText(`FN: ${company.company_register_number}${company.company_register_court ? ` (${company.company_register_court})` : ""}`, margin, y);
      y -= 12;
    }
    if (company?.phone) { drawText(`Tel: ${company.phone}`, margin, y); y -= 12; }
    if (company?.email) { drawText(company.email, margin, y); y -= 12; }
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

    // Shipping address if different
    if (invoice.shipping_address_mode && invoice.shipping_address_mode !== "same" && invoice.shipping_street) {
      y -= 8;
      drawText("Lieferanschrift:", margin, y, { bold: true, size: 8 });
      y -= 12;
      drawText(invoice.shipping_street, margin, y, { size: 8 }); y -= 11;
      drawText(`${invoice.shipping_zip || ""} ${invoice.shipping_city || ""}`.trim(), margin, y, { size: 8 }); y -= 11;
    }

    y -= 20;

    // --- DOCUMENT TITLE ---
    const titleText = `${docTitle} ${invoice.invoice_number}${invoice.version || ""}`;
    drawText(titleText, margin, y, { size: 16, bold: true });
    y -= 20;

    // Partial invoice reference
    if (relatedOrderNumber) {
      drawText(`Zu Auftrag: ${relatedOrderNumber}`, margin, y, { size: 9, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }

    // Delivery time (document level)
    if (invoice.delivery_time && ["quote", "order_confirmation", "delivery_note"].includes(documentType)) {
      drawText(`Lieferzeit: ${invoice.delivery_time}`, margin, y, { size: 9 });
      y -= 14;
    }

    // Meta info right-aligned
    const metaX = 380;
    const metaLabelMap: Record<string, string> = {
      quote: "Angebotsdatum",
      order_confirmation: "Auftragsdatum",
      delivery_note: "Lieferdatum",
      invoice: "Rechnungsdatum",
      credit_note: "Gutschriftsdatum",
    };
    const metaLabel = metaLabelMap[documentType] || "Datum";
    drawText(`${metaLabel}:`, metaX, y + 20); drawText(fmtDate(invoice.invoice_date), metaX + 100, y + 20);
    if (documentType === "invoice") {
      drawText("Fälligkeitsdatum:", metaX, y + 8); drawText(fmtDate(invoice.due_date), metaX + 100, y + 8);
    }
    if (invoice.payment_reference) {
      drawText("Zahlungsreferenz:", metaX, y - 4); drawText(invoice.payment_reference, metaX + 100, y - 4);
    }
    y -= 10;

    // --- LINE ITEMS TABLE ---
    const showVat = !isSmallBusiness;
    const colX = showVat
      ? { pos: margin, desc: margin + 25, qty: 310, unit: 355, price: 400, vat: 455, total: 500 }
      : { pos: margin, desc: margin + 25, qty: 330, unit: 380, price: 420, vat: 0, total: 490 };

    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;
    drawText("Pos", colX.pos, y, { bold: true, size: 8 });
    drawText("Beschreibung", colX.desc, y, { bold: true, size: 8 });
    drawText("Menge", colX.qty, y, { bold: true, size: 8 });
    drawText("Einheit", colX.unit, y, { bold: true, size: 8 });
    drawText("Preis", colX.price, y, { bold: true, size: 8 });
    if (showVat) drawText("MwSt", colX.vat, y, { bold: true, size: 8 });
    drawText("Netto", colX.total, y, { bold: true, size: 8 });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;

    const items = lineItems || [];
    let posCounter = 0;
    let currentGroupName: string | null = null;
    let groupSubtotal = 0;

    // Pre-load item images
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const imageCache: Record<string, any> = {};
    for (const item of items) {
      const imgPath = (item as any).image_path;
      if (imgPath && !imageCache[imgPath]) {
        try {
          const { data: imgData } = await adminClient.storage
            .from("item-images")
            .download(imgPath);
          if (imgData) {
            const imgBytes = new Uint8Array(await imgData.arrayBuffer());
            const isPng = imgPath.toLowerCase().endsWith(".png");
            imageCache[imgPath] = isPng
              ? await pdfDoc.embedPng(imgBytes)
              : await pdfDoc.embedJpg(imgBytes);
          }
        } catch (e) {
          console.error("Item image embed error:", e);
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as any;

      if (y < 100) break; // Safety

      // Group header
      if (item.is_group_header) {
        // Show subtotal of previous group if applicable
        if (currentGroupName && groupSubtotal > 0) {
          drawText(`Zwischensumme ${currentGroupName}`, colX.desc, y, { size: 8, bold: true, color: rgb(0.3, 0.3, 0.3) });
          drawText(fmtNum(groupSubtotal), colX.total, y, { size: 8, bold: true, color: rgb(0.3, 0.3, 0.3) });
          y -= 16;
        }
        currentGroupName = item.group_name || item.description;
        groupSubtotal = 0;

        // Draw group header
        page.drawRectangle({
          x: margin,
          y: y - 2,
          width: 495,
          height: 14,
          color: rgb(0.95, 0.95, 0.95),
        });
        drawText(item.description || item.group_name || "", colX.desc, y, { size: 9, bold: true });
        y -= 16;
        continue;
      }

      posCounter++;
      const lineNet = (item.quantity || 1) * (item.unit_price || 0);
      if (currentGroupName) groupSubtotal += lineNet;

      // Check if this item has an image
      const itemImage = item.image_path ? imageCache[item.image_path] : null;
      const rowHeight = itemImage ? 34 : 14;

      const desc = (item.description || "").substring(0, 45);
      const textY = itemImage ? y - 10 : y; // Center text vertically if image present

      drawText(String(posCounter), colX.pos, textY, { size: 8 });

      if (itemImage) {
        const imgDims = itemImage.scaleToFit(28, 28);
        page.drawImage(itemImage, {
          x: colX.desc,
          y: y - imgDims.height + 4,
          width: imgDims.width,
          height: imgDims.height,
        });
        drawText(desc, colX.desc + 32, textY, { size: 8 });
      } else {
        drawText(desc, colX.desc, textY, { size: 8 });
      }

      drawText(fmtNum(item.quantity || 1), colX.qty, textY, { size: 8 });
      drawText(item.unit || "Stk", colX.unit, textY, { size: 8 });
      drawText(fmtNum(item.unit_price || 0), colX.price, textY, { size: 8 });
      if (showVat) drawText(`${fmtNum(item.vat_rate || 0)} %`, colX.vat, textY, { size: 8 });
      drawText(fmtNum(lineNet), colX.total, textY, { size: 8 });
      y -= rowHeight;
    }

    // Final group subtotal
    if (currentGroupName && groupSubtotal > 0) {
      const lastGroupHeader = items.find((it: any) => it.is_group_header && (it.group_name === currentGroupName || it.description === currentGroupName)) as any;
      if (lastGroupHeader?.show_group_subtotal) {
        drawText(`Zwischensumme ${currentGroupName}`, colX.desc, y, { size: 8, bold: true, color: rgb(0.3, 0.3, 0.3) });
        drawText(fmtNum(groupSubtotal), colX.total, y, { size: 8, bold: true, color: rgb(0.3, 0.3, 0.3) });
        y -= 16;
      }
    }

    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;

    // --- TOTALS ---
    const totalsX = 400;
    drawText("Netto:", totalsX, y); drawText(fmtCur(invoice.subtotal || 0), 490, y);
    y -= 14;

    if (showVat) {
      // VAT groups
      const vatGroups: Record<number, number> = {};
      for (const item of items) {
        if ((item as any).is_group_header) continue;
        const lineNet = ((item as any).quantity || 1) * ((item as any).unit_price || 0);
        const rate = (item as any).vat_rate || 0;
        vatGroups[rate] = (vatGroups[rate] || 0) + lineNet * (rate / 100);
      }
      for (const [rate, amount] of Object.entries(vatGroups)) {
        drawText(`MwSt ${rate} %:`, totalsX, y); drawText(fmtCur(amount as number), 490, y);
        y -= 14;
      }
    }

    page.drawLine({ start: { x: totalsX, y: y + 4 }, end: { x: 545, y: y + 4 }, thickness: 1, color: rgb(0, 0, 0) });
    const totalAmount = isSmallBusiness ? (invoice.subtotal || 0) : (invoice.total || 0);
    drawText("Gesamt:", totalsX, y, { bold: true, size: 11 });
    drawText(fmtCur(totalAmount), 490, y, { bold: true, size: 11 });
    y -= 20;

    // Discount / Skonto
    if (invoice.discount_percent && invoice.discount_percent > 0) {
      const discountAmt = totalAmount * (invoice.discount_percent / 100);
      drawText(
        `Bei Zahlung innerhalb von ${invoice.discount_days || 0} Tagen: ${fmtNum(invoice.discount_percent)}% Skonto (${fmtCur(totalAmount - discountAmt)})`,
        margin, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }
      );
      y -= 16;
    }

    // Small business notice
    if (isSmallBusiness && company?.small_business_text) {
      drawText(company.small_business_text, margin, y, { size: 8, color: rgb(0.3, 0.3, 0.3) });
      y -= 16;
    }

    // --- NOTES ---
    if (invoice.notes) {
      drawText("Anmerkungen:", margin, y, { bold: true, size: 8 });
      y -= 12;
      drawText(invoice.notes.substring(0, 200), margin, y, { size: 8 });
      y -= 16;
    }

    // --- BANK DETAILS (from company_settings) ---
    if (company?.iban || company?.bank_name) {
      drawText("Bankverbindung:", margin, y, { bold: true, size: 8 });
      y -= 12;
      if (company.bank_name) { drawText(company.bank_name, margin, y, { size: 8 }); y -= 11; }
      if (company.account_holder) { drawText(`Kontoinhaber: ${company.account_holder}`, margin, y, { size: 8 }); y -= 11; }
      if (company.iban) { drawText(`IBAN: ${company.iban}`, margin, y, { size: 8 }); y -= 11; }
      if (company.bic) { drawText(`BIC: ${company.bic}`, margin, y, { size: 8 }); y -= 11; }
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
    const storagePath = `${userId}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}${invoice.version || ""}.pdf`;

    // adminClient already created above for image loading

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
