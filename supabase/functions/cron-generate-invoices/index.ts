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

    let processed = 0;
    let errors = 0;
    let emailsSent = 0;

    if (recurring && recurring.length > 0) {
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
              status: "draft",
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

          // Auto-send email if enabled
          if (rec.auto_send && rec.customers?.email) {
            try {
              // Generate PDF first
              const pdfRes = await supabase.functions.invoke("generate-invoice-pdf", {
                body: { invoiceId: newInvoice.id },
              });

              if (pdfRes.error) {
                console.error(`PDF generation failed for ${newInvoice.id}:`, pdfRes.error);
              } else {
                // Find user's email account
                const { data: emailAccounts } = await supabase
                  .from("email_accounts")
                  .select("id")
                  .eq("user_id", rec.user_id)
                  .eq("is_active", true)
                  .limit(1);

                if (emailAccounts && emailAccounts.length > 0) {
                  const sendRes = await supabase.functions.invoke("send-document-email", {
                    body: {
                      invoiceId: newInvoice.id,
                      recipientEmail: rec.customers.email,
                      emailAccountId: emailAccounts[0].id,
                      subject: `Rechnung ${invoiceNumber}`,
                      body: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${invoiceNumber}.\n\nMit freundlichen Grüßen`,
                      sendCopyToSelf: settings?.send_copy_to_self ?? true,
                    },
                  });

                  if (sendRes.error) {
                    console.error(`Email send failed for ${newInvoice.id}:`, sendRes.error);
                  } else {
                    emailsSent++;
                    console.log(`Email sent for invoice ${invoiceNumber} to ${rec.customers.email}`);
                  }
                } else {
                  console.log(`No active email account for user ${rec.user_id}, skipping email send`);
                }
              }
            } catch (emailErr) {
              console.error(`Email process error for ${newInvoice.id}:`, emailErr);
            }
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
    } else {
      console.log("No recurring invoices due.");
    }

    // ─── Overdue & Reminder Logic (per-user settings) ───

    // Get all users who have sent invoices with due dates in the past
    const { data: sentInvoices } = await supabase
      .from("invoices")
      .select("id, user_id, due_date, status, total, discount_percent")
      .in("status", ["sent", "overdue", "reminder_1"])
      .lt("due_date", today);

    let overdueCount = 0;
    let reminderCount = 0;

    if (sentInvoices && sentInvoices.length > 0) {
      // Group by user_id to fetch settings once per user
      const userIds = [...new Set(sentInvoices.map((inv: any) => inv.user_id))];
      const { data: allSettings } = await supabase
        .from("invoice_settings")
        .select("user_id, overdue_reminder_enabled, overdue_reminder_days, reminder_stage_1_days, reminder_stage_2_days, reminder_stage_3_days, overdue_email_notify")
        .in("user_id", userIds);

      const settingsMap = new Map<string, any>();
      if (allSettings) {
        for (const s of allSettings) {
          settingsMap.set(s.user_id, s);
        }
      }

      for (const inv of sentInvoices) {
        const userSettings = settingsMap.get(inv.user_id);
        const reminderEnabled = userSettings?.overdue_reminder_enabled ?? false;

        if (!reminderEnabled) continue;

        const dueDate = new Date(inv.due_date);
        const todayDate = new Date(today);
        const daysPastDue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        const stage1Days = userSettings?.reminder_stage_1_days ?? userSettings?.overdue_reminder_days ?? 7;
        const stage2Days = stage1Days + (userSettings?.reminder_stage_2_days ?? 14);
        const stage3Days = stage2Days + (userSettings?.reminder_stage_3_days ?? 14);

        let newStatus: string | null = null;

        if (inv.status === "sent" && daysPastDue >= stage1Days) {
          newStatus = "overdue";
        } else if (inv.status === "overdue" && daysPastDue >= stage2Days) {
          newStatus = "reminder_1";
        } else if (inv.status === "reminder_1" && daysPastDue >= stage3Days) {
          newStatus = "reminder_2";
        }

        if (newStatus) {
          const { error: updateErr } = await supabase
            .from("invoices")
            .update({ status: newStatus })
            .eq("id", inv.id);

          if (!updateErr) {
            // Track reminder
            const reminderLevel = newStatus === "overdue" ? 1 : newStatus === "reminder_1" ? 2 : 3;
            await supabase.from("invoice_reminders").insert({
              invoice_id: inv.id,
              user_id: inv.user_id,
              reminder_level: reminderLevel,
            });

            if (newStatus === "overdue") overdueCount++;
            else reminderCount++;

            console.log(`Invoice ${inv.id}: ${inv.status} → ${newStatus} (${daysPastDue} days past due)`);
          }
        }
      }
    }

    console.log(`Done: ${processed} created, ${emailsSent} emails, ${errors} errors, ${overdueCount} overdue, ${reminderCount} reminders`);

    return new Response(
      JSON.stringify({ processed, errors, emails_sent: emailsSent, overdue_updated: overdueCount, reminders_sent: reminderCount }),
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
