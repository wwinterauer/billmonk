export const RECEIPT_FIELDS =
  "id, status, file_name, file_type, receipt_date, vendor, vendor_brand, description, invoice_number, amount_gross, amount_net, vat_amount, vat_rate, is_mixed_tax_rate, tax_rate_details, line_items_raw, currency, category, tax_type, ai_confidence, is_duplicate, is_no_receipt_entry, notes";

export function ok(text: string, structured: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent: structured };
}

export function fail(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function mimeFor(fileType: string | null, fileName: string | null): string {
  const t = (fileType ?? fileName?.split(".").pop() ?? "").toLowerCase();
  if (t.includes("pdf")) return "application/pdf";
  if (t.includes("png")) return "image/png";
  if (t.includes("webp")) return "image/webp";
  if (t.includes("jp")) return "image/jpeg";
  return "application/octet-stream";
}

/** Net from gross; 0% VAT keeps net = gross. Mirrors the app's financial math. */
export function netFromGross(gross: number, vatRate: number): number {
  if (vatRate <= 0) return gross;
  return Math.round((gross / (1 + vatRate / 100)) * 100) / 100;
}
