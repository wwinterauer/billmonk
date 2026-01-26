import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractionResult {
  vendor: string | null;
  description: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  receipt_date: string | null;
  category: string | null;
  payment_method: string | null;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing imageBase64 or mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Lovable AI Gateway for receipt extraction...");

    const systemPrompt = `Du bist ein Experte für die Analyse von Belegen und Rechnungen. 
Extrahiere präzise alle relevanten Informationen aus dem Bild.
Antworte IMMER und AUSSCHLIESSLICH mit validem JSON ohne zusätzliche Erklärungen oder Markdown.`;

    const userPrompt = `Analysiere diesen Beleg/diese Rechnung und extrahiere folgende Informationen im JSON-Format:

{
  "vendor": "Name des Händlers/Lieferanten",
  "description": "Kurze Beschreibung was gekauft wurde (max 100 Zeichen)",
  "amount_gross": Bruttobetrag als Zahl,
  "amount_net": Nettobetrag als Zahl (falls erkennbar, sonst null),
  "vat_amount": MwSt-Betrag als Zahl (falls erkennbar, sonst null),
  "vat_rate": MwSt-Satz als Zahl (z.B. 20 für 20%, typisch in AT/DE: 19, 20, 7, 10),
  "receipt_date": "Datum im Format YYYY-MM-DD",
  "category": "Eine der Kategorien: Büromaterial, Software & Lizenzen, Reisekosten, Bewirtung, Telefon & Internet, Versicherungen, Miete & Betriebskosten, Fahrzeugkosten, Werbung & Marketing, Sonstiges",
  "payment_method": "Zahlungsart falls erkennbar: Überweisung, Kreditkarte, Bar, PayPal, Lastschrift (sonst null)",
  "confidence": Konfidenz deiner Erkennung von 0.0 bis 1.0
}

WICHTIGE REGELN:
- Antworte NUR mit dem JSON, keine zusätzlichen Erklärungen oder Markdown-Codeblöcke
- Falls ein Feld nicht erkennbar ist, setze es auf null
- Beträge immer als Dezimalzahlen ohne Währungssymbol (z.B. 125.50 statt "€ 125,50")
- Wenn nur Bruttobetrag erkennbar: versuche Netto und MwSt zu berechnen basierend auf erkennbarem MwSt-Satz
- Datum muss im Format YYYY-MM-DD sein`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in AI response:", aiResponse);
      return new Response(
        JSON.stringify({ success: false, error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    try {
      const extractedData: ExtractionResult = JSON.parse(cleanedContent);
      
      console.log("Successfully extracted receipt data:", {
        vendor: extractedData.vendor,
        amount_gross: extractedData.amount_gross,
        confidence: extractedData.confidence,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: extractedData,
          raw_response: content 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedContent);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to parse AI response", 
          raw: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Extract receipt error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
