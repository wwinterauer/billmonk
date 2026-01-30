import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY FIX: Authenticate user from JWT token instead of accepting userId from body
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Nicht authentifiziert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("[convert-image-to-pdf] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Ungültiger Token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use authenticated user ID instead of body-provided userId
    const userId = user.id;
    const { imageData, fileName, contentType } = await req.json();

    console.log(`[convert-image-to-pdf] Converting ${fileName} for authenticated user ${userId}`);

    if (!imageData || !fileName) {
      throw new Error("imageData und fileName sind erforderlich");
    }

    // Base64 zu Uint8Array
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    console.log(`[convert-image-to-pdf] Image size: ${imageBytes.length} bytes`);

    // PDF erstellen
    const pdfDoc = await PDFDocument.create();
    
    // Bild einbetten basierend auf Typ
    let image;
    const lowerContentType = contentType?.toLowerCase() || '';
    
    if (lowerContentType.includes("png")) {
      console.log(`[convert-image-to-pdf] Embedding PNG image`);
      image = await pdfDoc.embedPng(imageBytes);
    } else if (lowerContentType.includes("webp")) {
      // WebP muss erst zu PNG/JPG konvertiert werden - wir behandeln es als JPG
      // da pdf-lib kein WebP direkt unterstützt
      console.log(`[convert-image-to-pdf] WebP detected - attempting JPG embedding`);
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch (webpError) {
        console.error(`[convert-image-to-pdf] WebP as JPG failed:`, webpError);
        throw new Error("WebP-Format wird derzeit nicht unterstützt. Bitte als JPG oder PNG hochladen.");
      }
    } else {
      // JPEG/JPG
      console.log(`[convert-image-to-pdf] Embedding JPG image`);
      image = await pdfDoc.embedJpg(imageBytes);
    }

    // Seite in Bildgröße erstellen (max A4 ratio für bessere Lesbarkeit)
    const maxWidth = 595; // A4 width in points
    const maxHeight = 842; // A4 height in points
    
    let pageWidth = image.width;
    let pageHeight = image.height;
    
    // Scale down if image is too large
    if (pageWidth > maxWidth || pageHeight > maxHeight) {
      const widthRatio = maxWidth / pageWidth;
      const heightRatio = maxHeight / pageHeight;
      const scale = Math.min(widthRatio, heightRatio);
      pageWidth = pageWidth * scale;
      pageHeight = pageHeight * scale;
    }
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Bild auf volle Seitengröße zeichnen
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    console.log(`[convert-image-to-pdf] PDF page created: ${pageWidth}x${pageHeight}`);

    // PDF generieren
    const pdfBytes = await pdfDoc.save();
    console.log(`[convert-image-to-pdf] PDF generated: ${pdfBytes.length} bytes`);

    // Neuer Dateiname (.pdf statt .jpg/.png/.webp)
    const pdfFileName = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, ".pdf");

    // In Storage hochladen
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const safeFileName = pdfFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${year}/${month}/${uuid}_${safeFileName}`;

    console.log(`[convert-image-to-pdf] Uploading to: ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error(`[convert-image-to-pdf] Upload failed:`, uploadError);
      throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
    }

    // Hash für Duplikat-Check
    const pdfArrayBuffer = new Uint8Array(pdfBytes).buffer as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", pdfArrayBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    console.log(`[convert-image-to-pdf] Success! Hash: ${fileHash.substring(0, 16)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        storagePath,
        fileName: pdfFileName,
        fileType: "pdf",
        fileHash,
        fileSize: pdfBytes.length,
        originalSize: imageBytes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[convert-image-to-pdf] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
