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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("Starting recurring invoice generation...");

    const today = new Date().toISOString().split("T")[0];

    // Find all active recurring invoices due today or earlier
    const { data: recurring, error: recurErr } = await supabase
      .from("recurring_invoices")
      .select("*, customers(display_name, email)")
      .eq("is_active", true)
      .lte("next_invoice_date", today);

    if (recurErr) {
      console.error("Error fetching recurring invoices:", recurErr);
      return new Response(
        JSON.stringify({ error: recurErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recurring || recurring.length === 0) {
      console.log("No recurring invoices due.");
      return new Response(
        JSON.stringify({ processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const rec of recurring) {
      try {
        // Fetch user's invoice settings for numbering
        const { data: settings } = await supabase
          .from("invoice_settings")
          .select("*")
          .eq("user_id", rec.user_id)
          .maybeSingle();

        const prefix = settings?.invoice_number_prefix || "RE";
        const seq = settings?.next_sequence_number || 1;
        const year = new Date().getFullYear();
        const format = settings?.invoice_number_format || "{prefix}-{year}-{seq}";
        const invoiceNumber = format
          .replace("{prefix}", prefix)
          .replace("{year}", String(year))
          .replace("{seq}", String(seq).padStart(4, "0"));

        // Calculate due date
        const paymentDays = settings?.default_payment_terms_days || 14;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentDays);

        // Parse template line items
        const templateItems = Array.isArray(rec.template_line_items)
          ? rec.template_line_items
          : [];

        // Calculate totals
        let subtotal = 0;
        let vatTotal = 0;
        for (const item of templateItems) {
          const lineNet = (item.quantity || 1) * (item.unit_price || 0);
          subtotal += lineNet;
          vatTotal += lineNet * ((item.vat_rate || 0) / 100);
        }

        // Create invoice
        const { data: newInvoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            user_id: rec.user_id,
            customer_id: rec.customer_id,
            invoice_number: invoiceNumber,
            status: rec.auto_send ? "sent" : "draft",
            invoice_date: today,
            due_date: dueDate.toISOString().split("T")[0],
            subtotal,
            vat_total: vatTotal,
            total: subtotal + vatTotal,
            notes: rec.notes,
            footer_text: rec.footer_text,
            recurring_invoice_id: rec.id,
            sent_at: rec.auto_send ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (invErr || !newInvoice) {
          console.error(`Failed to create invoice for recurring ${rec.id}:`, invErr);
          errors++;
          continue;
        }

        // Create line items
        if (templateItems.length > 0) {
          const rows = templateItems.map((item: any, idx: number) => ({
            invoice_id: newInvoice.id,
            description: item.description || "",
            quantity: item.quantity || 1,
            unit: item.unit || "Stk",
            unit_price: item.unit_price || 0,
            vat_rate: item.vat_rate ?? 20,
            line_total: (item.quantity || 1) * (item.unit_price || 0),
            position: idx + 1,
          }));

          const { error: liErr } = await supabase
            .from("invoice_line_items")
            .insert(rows);

          if (liErr) {
            console.error(`Failed to create line items for invoice ${newInvoice.id}:`, liErr);
          }
        }

        // Increment sequence number
        if (settings) {
          await supabase
            .from("invoice_settings")
            .update({ next_sequence_number: seq + 1 })
            .eq("id", settings.id);
        }

        // Calculate next invoice date
        const nextDate = new Date(rec.next_invoice_date);
        switch (rec.interval) {
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "quarterly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        // Update recurring invoice
        await supabase
          .from("recurring_invoices")
          .update({
            next_invoice_date: nextDate.toISOString().split("T")[0],
            last_generated_at: new Date().toISOString(),
          })
          .eq("id", rec.id);

        console.log(`Created invoice ${invoiceNumber} for recurring ${rec.id}`);
        processed++;
      } catch (itemErr) {
        console.error(`Error processing recurring ${rec.id}:`, itemErr);
        errors++;
      }
    }

    // Check for overdue invoices and update status
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, due_date")
      .eq("status", "sent")
      .lt("due_date", today);

    let overdueCount = 0;
    if (overdueInvoices && overdueInvoices.length > 0) {
      const { error: overdueErr } = await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .eq("status", "sent")
        .lt("due_date", today);

      if (!overdueErr) {
        overdueCount = overdueInvoices.length;
      }
    }

    console.log(`Done: ${processed} created, ${errors} errors, ${overdueCount} marked overdue`);

    return new Response(
      JSON.stringify({ processed, errors, overdue_updated: overdueCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cron-generate-invoices error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
