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

    // Auth prüfen
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht authentifiziert");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Ungültiger Token");

    const { images, fileName } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error("Keine Bilder übergeben");
    }

    console.log(`Combining ${images.length} images to PDF for user ${user.id}`);

    // PDF erstellen
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imageBytes = Uint8Array.from(atob(img.data), c => c.charCodeAt(0));

      let image;
      if (img.contentType?.includes("png")) {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      // Seite in Bildgröße
      const page = pdfDoc.addPage([image.width, image.height]);
      
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });

      console.log(`Added page ${i + 1}: ${image.width}x${image.height}`);
    }

    const pdfBytes = await pdfDoc.save();

    // Storage-Pfad
    const now = new Date();
    const safeName = (fileName || 'beleg.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${safeName}`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);

    // Hash für Duplikat-Check
    const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(pdfBytes).buffer as ArrayBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    console.log(`Created ${images.length}-page PDF: ${storagePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        storagePath,
        fileName: safeName,
        fileType: "application/pdf",
        fileHash,
        fileSize: pdfBytes.length,
        pageCount: images.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Combine Images Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
