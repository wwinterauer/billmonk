import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// Rate limiting: Track requests per token
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
// IP-based rate limiting to prevent token enumeration
const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 20; // Max 20 emails per hour per token
const IP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const IP_RATE_LIMIT_MAX_REQUESTS = 50; // Max 50 requests per 10 min per IP

// Maximum file size per attachment (10MB)
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
// Maximum total attachments per email
const MAX_ATTACHMENTS_PER_EMAIL = 20;
// Minimum file size (to reject empty/corrupt files)
const MIN_ATTACHMENT_SIZE = 64;

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType: string;
  mimeType?: string; // Google Apps Script sends this instead of contentType
  size: number;
}

interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  token?: string;
}

// Check IP-based rate limit
function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= IP_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
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

// Verify webhook signature (HMAC-SHA256)
async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (signature.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return mismatch === 0;
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

// Verify file content matches declared type via magic bytes (deep check)
function verifyMagicBytes(content: Uint8Array, declaredType: string): boolean {
  if (content.length < 8) return false;

  const type = declaredType.toLowerCase();

  if (type.includes("pdf")) {
    // Check %PDF header
    if (!(content[0] === 0x25 && content[1] === 0x50 && content[2] === 0x44 && content[3] === 0x46)) return false;
    // Additional: check for %%EOF marker in last 1024 bytes (valid PDF structure)
    const tail = content.slice(Math.max(0, content.length - 1024));
    const tailStr = new TextDecoder("ascii", { fatal: false }).decode(tail);
    if (!tailStr.includes("%%EOF")) {
      console.warn("PDF missing %%EOF trailer — possibly truncated or malformed");
      // Allow but log — some valid PDFs from scanners lack this
    }
    return true;
  }
  if (type.includes("jpeg") || type.includes("jpg")) {
    // SOI marker + check for valid JFIF/Exif APP marker
    if (!(content[0] === 0xFF && content[1] === 0xD8 && content[2] === 0xFF)) return false;
    // APP0 (JFIF) = 0xE0, APP1 (Exif) = 0xE1, APP2 = 0xE2, etc.
    if (content[3] < 0xE0 && content[3] !== 0xDB && content[3] !== 0xC0) return false;
    return true;
  }
  if (type.includes("png")) {
    // Full 8-byte PNG signature
    const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    return content.slice(0, 8).every((b, i) => b === pngSig[i]);
  }
  if (type.includes("gif")) {
    // GIF87a or GIF89a
    const g = String.fromCharCode(...content.slice(0, 6));
    return g === "GIF87a" || g === "GIF89a";
  }
  if (type.includes("webp")) {
    // RIFF....WEBP
    if (!(content[0] === 0x52 && content[1] === 0x49 && content[2] === 0x46 && content[3] === 0x46)) return false;
    if (content.length < 12) return false;
    return content[8] === 0x57 && content[9] === 0x45 && content[10] === 0x42 && content[11] === 0x50;
  }

  return false; // Unknown type, reject
}

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^\.+/, "")
    .slice(0, 255);
}

// Extract client IP from request
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IP-based rate limiting (before any processing)
    const clientIp = getClientIp(req);
    if (!checkIpRateLimit(clientIp)) {
      console.warn("IP rate limit exceeded:", clientIp);
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "600" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Webhook signature verification (if secret is configured)
    if (webhookSecret) {
      const signature = req.headers.get("x-webhook-signature");
      const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error("Invalid webhook signature from IP:", clientIp);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse incoming email webhook
    const contentType = req.headers.get("content-type") || "";
    let emailData: InboundEmail;

    if (contentType.includes("application/json")) {
      try {
        emailData = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (contentType.includes("multipart/form-data")) {
      // Re-create request with the raw body for formData parsing
      const formReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: rawBody,
      });
      const formData = await formReq.formData();
      emailData = {
        from: (formData.get("from") as string) || (formData.get("From") as string) || "",
        to: (formData.get("to") as string) || (formData.get("To") as string) || "",
        subject: (formData.get("subject") as string) || (formData.get("Subject") as string) || "",
        text: (formData.get("text") as string) || (formData.get("TextBody") as string) || "",
        html: (formData.get("html") as string) || (formData.get("HtmlBody") as string) || "",
        attachments: [],
      };

      const attachmentsJson = formData.get("attachments") || formData.get("Attachments");
      if (attachmentsJson && typeof attachmentsJson === "string") {
        try {
          emailData.attachments = JSON.parse(attachmentsJson);
        } catch {
          console.log("Could not parse attachments JSON");
        }
      }
    } else {
      try {
        emailData = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid request format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Input validation
    if (!emailData.to || typeof emailData.to !== "string" || emailData.to.length > 500) {
      return new Response(JSON.stringify({ error: "Invalid recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (emailData.from && (typeof emailData.from !== "string" || emailData.from.length > 500)) {
      return new Response(JSON.stringify({ error: "Invalid sender" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Received email from:", emailData.from);
    console.log("To:", emailData.to);
    console.log("Subject:", emailData.subject?.slice(0, 100));
    console.log("Attachments count:", emailData.attachments?.length || 0);

    // Extract token from recipient email address
    // Supports: import+TOKEN@billmonk.ai (primary, plus-addressing)
    //           *+TOKEN@import.billmonk.ai (legacy subdomain with prefix)
    //           TOKEN@import.billmonk.ai (legacy subdomain plain)
    function extractTokenFromEmail(to: string): string | null {
      const lower = to.toLowerCase().trim();
      // Plus-addressing: import+TOKEN@billmonk.ai
      const plusMatch = lower.match(/^import\+([a-z0-9._-]{3,})@billmonk\.ai$/);
      if (plusMatch) return plusMatch[1];
      // Legacy plus-addressing: rechnungen+TOKEN@import.billmonk.ai
      const legacyPlusMatch = lower.match(/\+([a-z0-9._-]{3,})@import\.billmonk\.ai$/);
      if (legacyPlusMatch) return legacyPlusMatch[1];
      // Legacy subdomain plain: TOKEN@import.billmonk.ai
      const subdomainMatch = lower.match(/^([a-z0-9._-]{3,})@import\.billmonk\.ai$/);
      if (subdomainMatch) return subdomainMatch[1];
      return null;
    }

    let token = emailData.token;
    if (!token && emailData.to) {
      token = extractTokenFromEmail(emailData.to);
    }

    if (!token || token.length < 3 || !/^[a-z0-9._-]+$/.test(token)) {
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
      console.error("Email connection not found for token:", token.slice(0, 4) + "...");
      // Return generic error to prevent token enumeration
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
        from_address: emailData.from?.slice(0, 500),
        subject: emailData.subject?.slice(0, 1000),
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

    // Normalize: Google Apps Script sends mimeType instead of contentType
    const normalizedAttachments = attachments.map((att: any) => ({
      ...att,
      contentType: att.contentType || att.mimeType || '',
      size: att.size || (att.content ? Math.floor(att.content.length * 0.75) : 0),
    }));

    if (normalizedAttachments.length > MAX_ATTACHMENTS_PER_EMAIL) {
      console.warn(`Too many attachments (${normalizedAttachments.length}), limiting to ${MAX_ATTACHMENTS_PER_EMAIL}`);
    }

    const validAttachments = normalizedAttachments
      .slice(0, MAX_ATTACHMENTS_PER_EMAIL)
      .filter((att) => {
        if (!att.filename || typeof att.filename !== "string") {
          console.log("Skipping attachment with missing filename");
          return false;
        }
        if (!att.content || typeof att.content !== "string") {
          console.log("Skipping attachment with missing content");
          return false;
        }
        if (!isValidContentType(att.contentType, att.filename || "")) {
          console.log(`Skipping invalid content type: ${att.contentType} for ${sanitizeFilename(att.filename)}`);
          return false;
        }

        const size = att.size || (att.content ? att.content.length * 0.75 : 0);
        if (size > MAX_ATTACHMENT_SIZE) {
          console.log(`Skipping oversized file: ${sanitizeFilename(att.filename)} (${size} bytes)`);
          return false;
        }
        if (size < MIN_ATTACHMENT_SIZE) {
          console.log(`Skipping too-small file: ${sanitizeFilename(att.filename)} (${size} bytes)`);
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
        let binaryContent: Uint8Array;
        try {
          binaryContent = Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0));
        } catch {
          console.warn(`Invalid base64 for ${sanitizeFilename(attachment.filename)}, skipping`);
          errors.push(`Invalid encoding for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }

        // Verify magic bytes match declared content type
        if (!verifyMagicBytes(binaryContent, attachment.contentType || attachment.filename)) {
          console.warn(`Magic byte mismatch for ${sanitizeFilename(attachment.filename)}, skipping`);
          errors.push(`Invalid file content for ${sanitizeFilename(attachment.filename)}`);
          continue;
        }

        // Generate file hash for duplicate detection
        const hashBuffer = await crypto.subtle.digest("SHA-256", binaryContent);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

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
            email_subject: emailData.subject?.slice(0, 1000),
            email_from: emailData.from?.slice(0, 500),
            email_received_at: new Date().toISOString(),
            attachment_filename: attachment.filename,
            attachment_content_type: attachment.contentType,
            attachment_size: attachment.size || binaryContent.length,
            status: "processing",
            file_hash: fileHash,
            storage_path: storagePath,
          })
          .select()
          .single();

        if (attachmentError) {
          console.error("Error creating email attachment:", attachmentError);
          errors.push(`Attachment record failed for ${sanitizedFilename}`);
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
          console.log("Duplicate detected for:", sanitizedFilename);
          await supabase
            .from("email_attachments")
            .update({
              status: "duplicate",
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
            .update({ status: "error", error_message: "File upload failed" })
            .eq("id", emailAttachment.id);
          errors.push(`Upload failed for ${sanitizedFilename}`);
          continue;
        }

        // Create receipt record
        const { data: receipt, error: receiptError } = await supabase
          .from("receipts")
          .insert({
            user_id: userId,
            file_name: attachment.filename,
            file_url: storagePath,
            file_type: attachment.contentType,
            file_hash: fileHash,
            status: "processing",
            source: "email_webhook",
            email_attachment_id: emailAttachment.id,
            notes: `Importiert via E-Mail von ${emailData.from?.slice(0, 200)}${emailData.subject ? ` - Betreff: ${emailData.subject.slice(0, 200)}` : ""}`,
          })
          .select()
          .single();

        if (receiptError) {
          console.error("Error creating receipt:", receiptError);
          await supabase
            .from("email_attachments")
            .update({ status: "error", error_message: "Receipt creation failed" })
            .eq("id", emailAttachment.id);
          errors.push(`Receipt creation failed for ${sanitizedFilename}`);
          continue;
        }

        // Update email attachment with receipt reference
        await supabase
          .from("email_attachments")
          .update({
            status: "imported",
            receipt_id: receipt.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", emailAttachment.id);

        console.log("Created receipt:", receipt.id, "from attachment:", emailAttachment.id);

        // Trigger AI extraction
        try {
          const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-receipt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ receiptId: receipt.id }),
          });

          if (!extractResponse.ok) {
            const errorText = await extractResponse.text();
            console.error("AI extraction failed:", errorText);
            // Fallback: Receipt auf review setzen, damit User ihn sieht und manuell bearbeiten kann
            await supabase.from("receipts").update({
              status: "review",
              notes: `KI-Extraktion fehlgeschlagen. ${receipt.notes || ""}`.trim(),
            }).eq("id", receipt.id);
          } else {
            console.log("AI extraction triggered for receipt:", receipt.id);
          }
        } catch (extractError) {
          console.error("Error triggering AI extraction:", extractError);
          // Fallback: Receipt auf review setzen
          await supabase.from("receipts").update({
            status: "review",
            notes: `KI-Extraktion fehlgeschlagen. ${receipt.notes || ""}`.trim(),
          }).eq("id", receipt.id);
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
          error_message: errors.length > 0 ? errors.join("; ").slice(0, 2000) : null,
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
