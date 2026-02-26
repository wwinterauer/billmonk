import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// Rate limiting: Track requests per token
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 20; // Max 20 emails per hour per token

// Maximum file size per attachment (10MB)
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
// Maximum total attachments per email
const MAX_ATTACHMENTS_PER_EMAIL = 20;

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

// Check rate limit for a token
function checkRateLimit(token: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(token);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(token, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

// Validate file content type
function isValidContentType(contentType: string | undefined, filename: string): boolean {
  const validMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  
  const validExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  
  return validMimeTypes.includes(contentType?.toLowerCase() || "") || validExtensions.includes(ext);
}

// Verify file content matches declared type via magic bytes
function verifyMagicBytes(content: Uint8Array, declaredType: string): boolean {
  if (content.length < 4) return false;
  
  const pdfMagic = [0x25, 0x50, 0x44, 0x46]; // %PDF
  const jpegMagic = [0xFF, 0xD8, 0xFF];
  const pngMagic = [0x89, 0x50, 0x4E, 0x47]; // .PNG
  const gifMagic87 = [0x47, 0x49, 0x46, 0x38, 0x37]; // GIF87
  const gifMagic89 = [0x47, 0x49, 0x46, 0x38, 0x39]; // GIF89
  const webpMagic = [0x52, 0x49, 0x46, 0x46]; // RIFF (WebP starts with RIFF)
  
  const type = declaredType.toLowerCase();
  
  if (type.includes("pdf")) {
    return content.slice(0, 4).every((b, i) => b === pdfMagic[i]);
  }
  if (type.includes("jpeg") || type.includes("jpg")) {
    return content.slice(0, 3).every((b, i) => b === jpegMagic[i]);
  }
  if (type.includes("png")) {
    return content.slice(0, 4).every((b, i) => b === pngMagic[i]);
  }
  if (type.includes("gif")) {
    return content.slice(0, 5).every((b, i) => b === gifMagic87[i]) ||
           content.slice(0, 5).every((b, i) => b === gifMagic89[i]);
  }
  if (type.includes("webp")) {
    return content.slice(0, 4).every((b, i) => b === webpMagic[i]);
  }
  
  return false; // Unknown type, reject
}

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  // Remove path components and special characters
  return filename
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^\.+/, "")
    .slice(0, 255);
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

    if (!token || token.length < 12) {
      console.error("No valid token found in email address");
      return new Response(JSON.stringify({ error: "Invalid import address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check before database lookup
    const rateLimit = checkRateLimit(token);
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded for token:", token.slice(0, 4) + "...");
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": "3600",
        },
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
      // Log failed attempts for security monitoring (don't expose token in logs)
      console.error("Email connection not found for token:", token.slice(0, 4) + "...");
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

    // Process attachments with security validation
    const attachments = emailData.attachments || [];
    
    // Limit number of attachments
    if (attachments.length > MAX_ATTACHMENTS_PER_EMAIL) {
      console.warn(`Too many attachments (${attachments.length}), limiting to ${MAX_ATTACHMENTS_PER_EMAIL}`);
    }
    
    const validAttachments = attachments
      .slice(0, MAX_ATTACHMENTS_PER_EMAIL)
      .filter((att) => {
        // Validate content type and extension
        if (!isValidContentType(att.contentType, att.filename || "")) {
          console.log(`Skipping invalid content type: ${att.contentType} for ${att.filename}`);
          return false;
        }
        
        // Validate file size
        const size = att.size || (att.content ? att.content.length * 0.75 : 0); // Base64 is ~4/3 of original
        if (size > MAX_ATTACHMENT_SIZE) {
          console.log(`Skipping oversized file: ${att.filename} (${size} bytes)`);
          return false;
        }
        
        return true;
      });

    console.log("Valid attachments to process:", validAttachments.length);

    let processedCount = 0;
    const errors: string[] = [];

    for (const attachment of validAttachments) {
      try {
        // Decode base64 content
        const binaryContent = Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0));
        
        // Verify magic bytes match declared content type
        if (!verifyMagicBytes(binaryContent, attachment.contentType || attachment.filename)) {
          console.warn(`Magic byte mismatch for ${sanitizeFilename(attachment.filename)}, skipping`);
          errors.push(`Invalid file content for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }
        
        // Generate file hash for duplicate detection
        const hashBuffer = await crypto.subtle.digest('SHA-256', binaryContent);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate unique filename with proper sanitization
        const timestamp = Date.now();
        const randomSuffix = crypto.randomUUID().slice(0, 8);
        const sanitizedFilename = sanitizeFilename(attachment.filename || "attachment");
        const storagePath = `${userId}/${timestamp}_${randomSuffix}_${sanitizedFilename}`;

        // Create email attachment record first
        const { data: emailAttachment, error: attachmentError } = await supabase
          .from("email_attachments")
          .insert({
            email_connection_id: connection.id,
            email_import_id: importLog?.id || null,
            user_id: userId,
            email_message_id: null,
            email_subject: emailData.subject,
            email_from: emailData.from,
            email_received_at: new Date().toISOString(),
            attachment_filename: attachment.filename,
            attachment_content_type: attachment.contentType,
            attachment_size: attachment.size || binaryContent.length,
            status: 'processing',
            file_hash: fileHash,
            storage_path: storagePath,
          })
          .select()
          .single();

        if (attachmentError) {
          console.error("Error creating email attachment:", attachmentError);
          errors.push(`Attachment record failed for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }

        // Check for duplicates by file hash
        const { data: existingReceipt } = await supabase
          .from("receipts")
          .select("id")
          .eq("user_id", userId)
          .eq("file_hash", fileHash)
          .maybeSingle();

        if (existingReceipt) {
          console.log("Duplicate detected for:", attachment.filename);
          await supabase
            .from("email_attachments")
            .update({ 
              status: 'duplicate', 
              is_duplicate: true,
              duplicate_of: emailAttachment.id,
              processed_at: new Date().toISOString(),
            })
            .eq("id", emailAttachment.id);
          continue;
        }

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(storagePath, binaryContent, {
            contentType: attachment.contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          await supabase
            .from("email_attachments")
            .update({ status: 'error', error_message: 'File upload failed' })
            .eq("id", emailAttachment.id);
          errors.push(`Upload failed for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }

        // Create receipt record with source and email_attachment_id
        const { data: receipt, error: receiptError } = await supabase
          .from("receipts")
          .insert({
            user_id: userId,
            file_name: attachment.filename,
            file_url: storagePath,
            file_type: attachment.contentType,
            file_hash: fileHash,
            status: "pending",
            source: "email_webhook",
            email_attachment_id: emailAttachment.id,
            notes: `Importiert via E-Mail von ${emailData.from}${emailData.subject ? ` - Betreff: ${emailData.subject}` : ""}`,
          })
          .select()
          .single();

        if (receiptError) {
          console.error("Error creating receipt:", receiptError);
          await supabase
            .from("email_attachments")
            .update({ status: 'error', error_message: 'Receipt creation failed' })
            .eq("id", emailAttachment.id);
          errors.push(`Receipt creation failed for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }

        // Update email attachment with receipt reference
        await supabase
          .from("email_attachments")
          .update({ 
            status: 'imported', 
            receipt_id: receipt.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", emailAttachment.id);

        console.log("Created receipt:", receipt.id, "from attachment:", emailAttachment.id);

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
        errors.push(`Processing failed for ${sanitizeFilename(attachment.filename)}`);
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
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
