import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType: string;
  size: number;
}

interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  // Token from email address like receipts+TOKEN@domain.com
  token?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse incoming email webhook (format depends on email service)
    const contentType = req.headers.get("content-type") || "";
    let emailData: InboundEmail;

    if (contentType.includes("application/json")) {
      emailData = await req.json();
    } else if (contentType.includes("multipart/form-data")) {
      // Handle form data from services like Postmark, SendGrid
      const formData = await req.formData();
      emailData = {
        from: formData.get("from") as string || formData.get("From") as string || "",
        to: formData.get("to") as string || formData.get("To") as string || "",
        subject: formData.get("subject") as string || formData.get("Subject") as string || "",
        text: formData.get("text") as string || formData.get("TextBody") as string || "",
        html: formData.get("html") as string || formData.get("HtmlBody") as string || "",
        attachments: [],
      };

      // Try to parse attachments from common formats
      const attachmentsJson = formData.get("attachments") || formData.get("Attachments");
      if (attachmentsJson && typeof attachmentsJson === "string") {
        try {
          emailData.attachments = JSON.parse(attachmentsJson);
        } catch {
          console.log("Could not parse attachments JSON");
        }
      }
    } else {
      // Try to parse as JSON anyway
      const text = await req.text();
      try {
        emailData = JSON.parse(text);
      } catch {
        console.error("Could not parse request body");
        return new Response(JSON.stringify({ error: "Invalid request format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Received email from:", emailData.from);
    console.log("To:", emailData.to);
    console.log("Subject:", emailData.subject);
    console.log("Attachments count:", emailData.attachments?.length || 0);

    // Extract token from recipient email address
    // Format: receipts+TOKEN@domain.com or TOKEN@receipts.domain.com
    let token = emailData.token;
    if (!token && emailData.to) {
      const toAddress = emailData.to.toLowerCase();
      // Try format: prefix+TOKEN@domain
      const plusMatch = toAddress.match(/\+([a-z0-9]+)@/);
      if (plusMatch) {
        token = plusMatch[1];
      } else {
        // Try format: TOKEN@subdomain
        const subdomainMatch = toAddress.match(/^([a-z0-9]+)@/);
        if (subdomainMatch) {
          token = subdomainMatch[1];
        }
      }
    }

    if (!token) {
      console.error("No token found in email address");
      return new Response(JSON.stringify({ error: "Invalid import address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find email connection by token
    const { data: connection, error: connectionError } = await supabase
      .from("email_connections")
      .select("*")
      .eq("import_token", token)
      .eq("is_active", true)
      .single();

    if (connectionError || !connection) {
      console.error("Email connection not found for token:", token);
      return new Response(JSON.stringify({ error: "Invalid or inactive import address" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = connection.user_id;
    console.log("Found user for email import:", userId);

    // Create email import log
    const { data: importLog, error: importError } = await supabase
      .from("email_imports")
      .insert({
        email_connection_id: connection.id,
        user_id: userId,
        from_address: emailData.from,
        subject: emailData.subject,
        status: "processing",
        attachments_count: emailData.attachments?.length || 0,
        raw_data: {
          to: emailData.to,
          hasText: !!emailData.text,
          hasHtml: !!emailData.html,
        },
      })
      .select()
      .single();

    if (importError) {
      console.error("Error creating import log:", importError);
    }

    // Process attachments
    const validAttachments = (emailData.attachments || []).filter((att) => {
      const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
      return validTypes.includes(att.contentType?.toLowerCase() || "") || 
             att.filename?.toLowerCase().endsWith(".pdf") ||
             att.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
    });

    console.log("Valid attachments to process:", validAttachments.length);

    let processedCount = 0;
    const errors: string[] = [];

    for (const attachment of validAttachments) {
      try {
        // Decode base64 content
        const binaryContent = Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0));
        
        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `${userId}/${timestamp}_${sanitizedFilename}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(storagePath, binaryContent, {
            contentType: attachment.contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          errors.push(`Upload failed for ${attachment.filename}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("receipts")
          .getPublicUrl(storagePath);

        // Create receipt record
        const { data: receipt, error: receiptError } = await supabase
          .from("receipts")
          .insert({
            user_id: userId,
            file_name: attachment.filename,
            file_url: storagePath,
            file_type: attachment.contentType,
            status: "pending",
            notes: `Importiert via E-Mail von ${emailData.from}${emailData.subject ? ` - Betreff: ${emailData.subject}` : ""}`,
          })
          .select()
          .single();

        if (receiptError) {
          console.error("Error creating receipt:", receiptError);
          errors.push(`Receipt creation failed for ${attachment.filename}: ${receiptError.message}`);
          continue;
        }

        console.log("Created receipt:", receipt.id);

        // Trigger AI extraction (call the existing edge function)
        try {
          const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-receipt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ receiptId: receipt.id }),
          });

          if (!extractResponse.ok) {
            console.error("AI extraction failed:", await extractResponse.text());
          } else {
            console.log("AI extraction triggered for receipt:", receipt.id);
          }
        } catch (extractError) {
          console.error("Error triggering AI extraction:", extractError);
        }

        processedCount++;
      } catch (attError) {
        console.error("Error processing attachment:", attError);
        errors.push(`Processing failed for ${attachment.filename}: ${String(attError)}`);
      }
    }

    // Update import log
    if (importLog) {
      await supabase
        .from("email_imports")
        .update({
          status: errors.length > 0 ? "partial" : "completed",
          processed_receipts: processedCount,
          error_message: errors.length > 0 ? errors.join("; ") : null,
        })
        .eq("id", importLog.id);
    }

    // Update connection stats
    await supabase
      .from("email_connections")
      .update({
        last_import_at: new Date().toISOString(),
        import_count: connection.import_count + processedCount,
      })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Email import webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
