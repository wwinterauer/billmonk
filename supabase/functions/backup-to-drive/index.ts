import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data;
}

async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Folder creation failed: ${response.status} ${errorText}`);
  }
  const result = await response.json();
  return result.id;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const searchResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchResp.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;
  return createDriveFolder(accessToken, name, parentId);
}

async function uploadFileToDrive(accessToken: string, fileName: string, content: Uint8Array, mimeType: string, folderId?: string): Promise<string> {
  const metadata: Record<string, unknown> = { name: fileName, mimeType };
  if (folderId) metadata.parents = [folderId];

  const boundary = "backup_boundary_" + crypto.randomUUID();
  const metadataStr = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    content,
    encoder.encode(`\r\n--${boundary}--`),
  ];

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.id;
}

// Simple ZIP builder (no external lib needed in Deno)
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number; crc: number }[] = [];
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);

    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // compression (store)
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    view.setUint32(14, crc, true); // crc32
    view.setUint32(18, file.data.length, true); // compressed size
    view.setUint32(22, file.data.length, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true); // name length
    view.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: file.data, offset, crc });
    parts.push(header, file.data);
    offset += header.length + file.data.length;
  }

  // Central directory
  const centralStart = offset;
  for (const entry of entries) {
    const cd = new Uint8Array(46 + entry.name.length);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, entry.crc, true);
    cdView.setUint32(20, entry.data.length, true);
    cdView.setUint32(24, entry.data.length, true);
    cdView.setUint16(28, entry.name.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, entry.offset, true);
    cd.set(entry.name, 46);
    parts.push(cd);
    offset += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, offset - centralStart, true);
  eocdView.setUint32(16, centralStart, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

interface ExportColumn {
  field: string;
  label: string;
  type: string;
  visible: boolean;
  order: number;
}

function formatCsvValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "";
  if (type === "currency") return String(Number(value).toFixed(2)).replace(".", ",");
  if (type === "percent") return `${value}%`;
  const str = String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(receipts: any[], columns: ExportColumn[]): Uint8Array {
  const visibleCols = columns.filter(c => c.visible && c.type !== "empty").sort((a, b) => a.order - b.order);
  const header = visibleCols.map(c => c.label).join(";");
  const rows = receipts.map(r =>
    visibleCols.map(c => formatCsvValue(r[c.field], c.type)).join(";")
  ).join("\n");

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const content = new TextEncoder().encode(header + "\n" + rows);
  const result = new Uint8Array(bom.length + content.length);
  result.set(bom);
  result.set(content, bom.length);
  return result;
}

// Simple XLSX generation (single sheet, no external lib)
function generateXlsx(receipts: any[], columns: ExportColumn[]): Uint8Array {
  const visibleCols = columns.filter(c => c.visible && c.type !== "empty").sort((a, b) => a.order - b.order);
  
  // Build shared strings
  const sharedStrings: string[] = [];
  const ssIndex = (s: string): number => {
    const idx = sharedStrings.indexOf(s);
    if (idx >= 0) return idx;
    sharedStrings.push(s);
    return sharedStrings.length - 1;
  };

  // Build sheet XML
  const colLetter = (i: number) => String.fromCharCode(65 + (i % 26));
  
  let sheetRows = "";
  // Header row
  sheetRows += `<row r="1">`;
  visibleCols.forEach((c, i) => {
    const ref = `${colLetter(i)}1`;
    sheetRows += `<c r="${ref}" t="s"><v>${ssIndex(escapeXml(c.label))}</v></c>`;
  });
  sheetRows += `</row>`;

  // Data rows
  receipts.forEach((r, rowIdx) => {
    const rowNum = rowIdx + 2;
    sheetRows += `<row r="${rowNum}">`;
    visibleCols.forEach((c, colIdx) => {
      const ref = `${colLetter(colIdx)}${rowNum}`;
      const val = r[c.field];
      if (val === null || val === undefined) {
        sheetRows += `<c r="${ref}"><v></v></c>`;
      } else if (c.type === "currency" || c.type === "number" || c.type === "percent") {
        sheetRows += `<c r="${ref}"><v>${val}</v></c>`;
      } else {
        sheetRows += `<c r="${ref}" t="s"><v>${ssIndex(escapeXml(String(val)))}</v></c>`;
      }
    });
    sheetRows += `</row>`;
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t>${s}</t></si>`).join("")}
</sst>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Belege" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const enc = new TextEncoder();
  return buildZip([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(relsXml) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRelsXml) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml) },
    { name: "xl/sharedStrings.xml", data: enc.encode(ssXml) },
  ]);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { field: "receipt_date", label: "Datum", type: "date", visible: true, order: 0 },
  { field: "vendor", label: "Lieferant", type: "text", visible: true, order: 1 },
  { field: "description", label: "Beschreibung", type: "text", visible: true, order: 2 },
  { field: "invoice_number", label: "Rechnungsnr.", type: "text", visible: true, order: 3 },
  { field: "category", label: "Kategorie", type: "text", visible: true, order: 4 },
  { field: "amount_gross", label: "Brutto", type: "currency", visible: true, order: 5 },
  { field: "amount_net", label: "Netto", type: "currency", visible: true, order: 6 },
  { field: "vat_rate", label: "MwSt-Satz", type: "percent", visible: true, order: 7 },
  { field: "vat_amount", label: "Vorsteuer", type: "currency", visible: true, order: 8 },
  { field: "status", label: "Status", type: "text", visible: true, order: 9 },
  { field: "file_name", label: "Dateiname", type: "text", visible: true, order: 10 },
];

const DEFAULT_INVOICE_COLUMNS: ExportColumn[] = [
  { field: "invoice_number", label: "Rechnungsnr.", type: "text", visible: true, order: 0 },
  { field: "customer_name", label: "Kunde", type: "text", visible: true, order: 1 },
  { field: "invoice_date", label: "Rechnungsdatum", type: "date", visible: true, order: 2 },
  { field: "due_date", label: "Fällig am", type: "date", visible: true, order: 3 },
  { field: "category", label: "Kategorie", type: "text", visible: true, order: 4 },
  { field: "subtotal", label: "Netto", type: "currency", visible: true, order: 5 },
  { field: "vat_total", label: "USt", type: "currency", visible: true, order: 6 },
  { field: "total", label: "Brutto", type: "currency", visible: true, order: 7 },
  { field: "status", label: "Status", type: "text", visible: true, order: 8 },
];

function resolveZipName(pattern: string, prefix: string, count: number): string {
  const now = new Date();
  return pattern
    .replace("{prefix}", prefix)
    .replace("{datum}", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
    .replace("{zeit}", `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`)
    .replace("{anzahl}", String(count))
    .replace("{monat}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace("{jahr}", String(now.getFullYear()));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht authentifiziert");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Ungültiger Token");

    const { connectionId } = await req.json();

    // Connection laden
    const { data: connection, error: connError } = await supabase
      .from("cloud_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) throw new Error("Cloud-Verbindung nicht gefunden");
    if (!connection.oauth_refresh_token) throw new Error("Kein Refresh-Token vorhanden. Bitte Google Drive erneut verbinden.");

    // Token refresh
    const tokenData = await refreshGoogleToken(connection.oauth_refresh_token);
    const accessToken = tokenData.access_token;

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await supabase
      .from("cloud_connections")
      .update({ oauth_access_token: accessToken, oauth_token_expires_at: newExpiresAt.toISOString() })
      .eq("id", connection.id);

    // Belege laden (inkrementell: nur noch nie gesicherte)
    const statusFilter = connection.backup_status_filter || ["review"];
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("id, file_name, file_url, vendor, amount_gross, amount_net, receipt_date, category, vat_rate, vat_amount, status, custom_filename, description, invoice_number, payment_method, notes")
      .eq("user_id", user.id)
      .is("cloud_backup_at", null)
      .in("status", statusFilter)
      .order("receipt_date", { ascending: true });

    if (receiptsError) throw new Error(`Belege laden fehlgeschlagen: ${receiptsError.message}`);

    if (!receipts || receipts.length === 0) {
      await supabase
        .from("cloud_connections")
        .update({ last_backup_at: new Date().toISOString(), last_backup_count: 0, last_backup_error: null })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true, message: "Keine neuen Belege zum Sichern.", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load export template if configured
    let columns: ExportColumn[] = DEFAULT_COLUMNS;
    if (connection.backup_template_id) {
      const { data: template } = await supabase
        .from("export_templates")
        .select("columns")
        .eq("id", connection.backup_template_id)
        .eq("user_id", user.id)
        .single();

      if (template?.columns) {
        columns = (template.columns as unknown as ExportColumn[]);
      }
    }

    const includeExcel = connection.backup_include_excel ?? true;
    const includeCsv = connection.backup_include_csv ?? true;
    const includeFiles = connection.backup_include_files ?? true;
    const zipPattern = connection.backup_zip_pattern || "{prefix}_{datum}_{zeit}";
    const folderStructure = connection.backup_folder_structure || "flat";
    const prefix = connection.backup_file_prefix || "BillMonk-Backup";

    // Determine target folder
    let targetFolderId = connection.backup_folder_id || undefined;

    if (folderStructure === "monthly" && targetFolderId) {
      const now = new Date();
      const yearFolder = await findOrCreateFolder(accessToken, String(now.getFullYear()), targetFolderId);
      targetFolderId = await findOrCreateFolder(accessToken, String(now.getMonth() + 1).padStart(2, "0"), yearFolder);
    }

    // Build ZIP contents
    const zipFiles: { name: string; data: Uint8Array }[] = [];

    // Add CSV if enabled
    if (includeCsv) {
      const csvData = generateCsv(receipts, columns);
      zipFiles.push({ name: "Zusammenfassung.csv", data: csvData });
    }

    // Add Excel if enabled
    if (includeExcel) {
      const xlsxData = generateXlsx(receipts, columns);
      zipFiles.push({ name: "Zusammenfassung.xlsx", data: xlsxData });
    }

    // Add PDF files if enabled
    let uploadedFiles = 0;
    if (includeFiles) {
      for (const receipt of receipts) {
        if (!receipt.file_url) continue;

        try {
          const urlParts = receipt.file_url.split("/storage/v1/object/public/");
          if (urlParts.length < 2) continue;

          const storagePath = urlParts[1];
          const bucketAndPath = storagePath.split("/");
          const bucket = bucketAndPath[0];
          const filePath = bucketAndPath.slice(1).join("/");

          const { data: fileData, error: fileError } = await supabase.storage
            .from(bucket)
            .download(filePath);

          if (fileError || !fileData) {
            console.error(`Failed to download ${receipt.file_name}:`, fileError);
            continue;
          }

          const fileBytes = new Uint8Array(await fileData.arrayBuffer());
          const pdfFileName = receipt.custom_filename || receipt.file_name || `beleg_${receipt.id}.pdf`;

          // For category folder structure, put in subfolder
          const zipPath = folderStructure === "category" && receipt.category
            ? `${receipt.category}/${pdfFileName}`
            : pdfFileName;

          zipFiles.push({ name: zipPath, data: fileBytes });
          uploadedFiles++;
        } catch (fileErr) {
          console.error(`Error downloading file for receipt ${receipt.id}:`, fileErr);
        }
      }
    }

    // === INVOICES BACKUP ===
    const includeInvoices = connection.backup_include_invoices ?? false;
    let invoiceCount = 0;

    if (includeInvoices) {
      // Load invoices with customer names
      const { data: invoicesData, error: invError } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, total, subtotal, vat_total, status, paid_at, category, pdf_storage_path, customers(display_name)")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("invoice_date", { ascending: true });

      if (!invError && invoicesData && invoicesData.length > 0) {
        // Flatten customer name
        const flatInvoices = invoicesData.map(inv => ({
          ...inv,
          customer_name: (inv.customers as any)?.display_name || "",
        }));

        // Load invoice export template if available
        let invColumns: ExportColumn[] = DEFAULT_INVOICE_COLUMNS;
        if (connection.backup_template_id) {
          const { data: invTemplate } = await supabase
            .from("export_templates")
            .select("columns, template_type")
            .eq("id", connection.backup_template_id)
            .eq("user_id", user.id)
            .single();

          if (invTemplate && (invTemplate as any).template_type === "invoices" && invTemplate.columns) {
            invColumns = invTemplate.columns as unknown as ExportColumn[];
          }
        }

        // Add invoice CSV
        if (includeCsv) {
          const invCsv = generateCsv(flatInvoices, invColumns);
          zipFiles.push({ name: "Ausgangsrechnungen/Rechnungen.csv", data: invCsv });
        }

        // Add invoice Excel
        if (includeExcel) {
          const invXlsx = generateXlsx(flatInvoices, invColumns);
          zipFiles.push({ name: "Ausgangsrechnungen/Rechnungen.xlsx", data: invXlsx });
        }

        // Add invoice PDFs
        for (const inv of invoicesData) {
          if (!inv.pdf_storage_path) continue;
          try {
            const { data: pdfData, error: pdfError } = await supabase.storage
              .from("invoices")
              .download(inv.pdf_storage_path);

            if (pdfError || !pdfData) continue;

            const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
            const pdfName = `${inv.invoice_number || inv.id}.pdf`;
            zipFiles.push({ name: `Ausgangsrechnungen/${pdfName}`, data: pdfBytes });
            invoiceCount++;
          } catch (err) {
            console.error(`Error downloading invoice PDF ${inv.id}:`, err);
          }
        }
      }
    }

    // Build and upload ZIP
    const zipData = buildZip(zipFiles);
    const zipName = resolveZipName(zipPattern, prefix, receipts.length) + ".zip";

    await uploadFileToDrive(accessToken, zipName, zipData, "application/zip", targetFolderId);

    // Mark receipts as backed up
    const receiptIds = receipts.map(r => r.id);
    const batchSize = 50;
    for (let i = 0; i < receiptIds.length; i += batchSize) {
      const batch = receiptIds.slice(i, i + batchSize);
      await supabase
        .from("receipts")
        .update({ cloud_backup_at: new Date().toISOString() })
        .in("id", batch);
    }

    // Update connection status
    await supabase
      .from("cloud_connections")
      .update({
        last_backup_at: new Date().toISOString(),
        last_backup_count: receipts.length + invoiceCount,
        last_backup_error: null,
        last_sync: new Date().toISOString(),
      })
      .eq("id", connection.id);

    console.log(`Backup completed: ${receipts.length} receipts, ${uploadedFiles} files, ${invoiceCount} invoices, ZIP: ${zipName}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${receipts.length} Belege${invoiceCount > 0 ? ` und ${invoiceCount} Rechnungen` : ''} als ZIP gesichert (${zipName}).`,
        count: receipts.length,
        filesUploaded: uploadedFiles,
        invoicesUploaded: invoiceCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Backup Error:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { connectionId } = await req.clone().json().catch(() => ({ connectionId: null }));
      if (connectionId) {
        await supabase
          .from("cloud_connections")
          .update({ last_backup_error: error.message })
          .eq("id", connectionId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
