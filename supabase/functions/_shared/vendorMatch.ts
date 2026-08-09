// Shared vendor name normalization + matching logic.
// Used by `extract-receipt` (during AI extraction) and `reconcile-vendors`
// (retroactive linking) so both paths apply exactly the same rules.

// Legal form suffixes for DACH + common international forms
export const LEGAL_FORM_REGEX =
  /\b(GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|KG|OG|OHG|e\.?\s*U\.?|EU|UG(?:\s*\(haftungsbeschr[äa]nkt\))?|SE|S\.E\.|Ltd\.?|Limited|LLC|Inc\.?|Corp\.?|S\.à\s*r\.?l\.?|S\.A\.|S\.A\.S\.|S\.r\.l\.?|S\.p\.A\.|B\.V\.|N\.V\.|Co\.?\s*KG|Kft\.?|sp\.?\s*z\s*o\.?o\.?|d\.o\.o\.?|GbR|PartG|HandelsgesmbH|Handels\s?GmbH)\b/i;

export function hasLegalForm(name: string | null | undefined): boolean {
  if (!name) return false;
  return LEGAL_FORM_REGEX.test(name);
}

// Collapse repeated legal-form suffixes the AI sometimes duplicates, e.g.
// "Stripe Payments Europe, Limited Limited" or "Limberger HandelsgesmbH HandelsgesmbH".
export function dedupeLegalForms(name: string | null | undefined): string {
  if (!name) return "";
  const tokens = name.trim().split(/\s+/);
  const out: string[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    const bare = (s: string) => s.replace(/[.,]/g, "").toLowerCase();
    if (prev && bare(prev) === bare(token) && LEGAL_FORM_REGEX.test(token)) continue;
    out.push(token);
  }
  return out.join(" ");
}

// Combine an extracted vendor name with its legal form (e.g. "HOFER" + "KG"),
// avoiding duplicates like "HOFER KG KG".
export function combineVendorWithLegalForm(
  name: string | null | undefined,
  legalForm: string | null | undefined,
): string | null {
  const base = (name ?? "").trim();
  if (!base) return null;
  const lf = (legalForm ?? "").trim();
  if (!lf) return dedupeLegalForms(base);
  if (hasLegalForm(base)) return dedupeLegalForms(base);
  return dedupeLegalForms(`${base} ${lf}`);
}



// Normalize vendor name for matching: dedupe legal forms, lowercase,
// strip legal form, collapse whitespace/punctuation.
export function normalizeVendorName(name: string | null | undefined): string {
  if (!name) return "";
  let value = dedupeLegalForms(name).toLowerCase();
  // Strip every legal form occurrence, not just the first one.
  const global = new RegExp(LEGAL_FORM_REGEX.source, "gi");
  value = value.replace(global, " ");
  return value.replace(/[.,&]/g, " ").replace(/\s+/g, " ").trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function nameSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface VendorCandidate {
  id: string;
  display_name: string | null;
  legal_names?: string[] | null;
  [key: string]: unknown;
}

export const FUZZY_THRESHOLD = 0.88;
// A brand token embedded in a longer legal name only counts as a match when the
// vendor is already established — otherwise big vendors would swallow small ones.
export const MIN_RECEIPTS_FOR_TOKEN_MATCH = 3;
// Fuzzy scores within this margin are treated as a tie, broken by receipt volume.
export const TIE_MARGIN = 0.02;

export type ReceiptCounts = Record<string, number>;

function countOf(counts: ReceiptCounts | undefined, id: string): number {
  return counts?.[id] ?? 0;
}

// Does `haystack` contain `needle` as a standalone word sequence?
function containsToken(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
}

// Match an extracted vendor name (+ optional brand) against the user's vendors.
// `receiptCounts` (vendorId -> number of linked receipts) is optional; without it
// the behaviour is identical to before.
export function matchVendor<T extends VendorCandidate>(
  vendors: T[] | null | undefined,
  vendorName: string | null | undefined,
  vendorBrand?: string | null,
  receiptCounts?: ReceiptCounts,
): T | null {
  if (!vendors || vendors.length === 0) return null;
  const rawName = (vendorName || "").trim();
  const brandRaw = (vendorBrand || "").trim();
  if (!rawName && !brandRaw) return null;

  const extractedLower = rawName.toLowerCase();
  const dedupedLower = dedupeLegalForms(rawName).toLowerCase();
  const extractedNorm = normalizeVendorName(rawName);

  // 1. Exact (case-insensitive) display_name match — raw or de-duplicated
  let match =
    vendors.find(v => {
      const dn = (v.display_name || "").toLowerCase().trim();
      return dn && (dn === extractedLower || dn === dedupedLower);
    }) || null;
  if (match) { console.log(`[vendorMatch] stage=exact-display vendor=${match.display_name}`); return match; }

  // 2. Exact legal_names match
  match =
    vendors.find(v =>
      (v.legal_names || []).some((ln: string) => {
        const l = ln.toLowerCase().trim();
        return l === extractedLower || l === dedupedLower;
      }),
    ) || null;
  if (match) { console.log(`[vendorMatch] stage=legal-name vendor=${match.display_name}`); return match; }

  // 3. Normalized match (legal form stripped) on display_name OR legal_names
  if (extractedNorm) {
    match =
      vendors.find(v => {
        if (normalizeVendorName(v.display_name) === extractedNorm) return true;
        return (v.legal_names || []).some((ln: string) => normalizeVendorName(ln) === extractedNorm);
      }) || null;
    if (match) { console.log(`[vendorMatch] stage=normalized vendor=${match.display_name}`); return match; }
  }

  // 4. Brand match — invoices often carry the legal entity in `vendor`
  //    but the known brand in `vendor_brand`.
  const brandLower = brandRaw.toLowerCase();
  const brandNorm = normalizeVendorName(brandRaw);
  if (brandRaw) {
    match =
      vendors.find(v => {
        if ((v.display_name || "").toLowerCase().trim() === brandLower) return true;
        if (brandNorm && normalizeVendorName(v.display_name) === brandNorm) return true;
        return (v.legal_names || []).some(
          (ln: string) =>
            ln.toLowerCase().trim() === brandLower || (brandNorm && normalizeVendorName(ln) === brandNorm),
        );
      }) || null;
    if (match) { console.log(`[vendorMatch] stage=brand vendor=${match.display_name}`); return match; }
  }

  // 4b. Brand token contained in the extracted legal name, e.g.
  //     "stripe payments europe" → vendor "Stripe". Only for established
  //     vendors (>= MIN_RECEIPTS_FOR_TOKEN_MATCH linked receipts); ties broken
  //     by the longer (more specific) vendor name, then by receipt volume.
  {
    const haystacks = [extractedNorm, brandNorm].filter(n => n && n.length >= 4);
    if (haystacks.length > 0) {
      let best: T | null = null;
      let bestLen = 0;
      let bestCount = 0;
      for (const v of vendors) {
        if (countOf(receiptCounts, v.id) < MIN_RECEIPTS_FOR_TOKEN_MATCH) continue;
        const candidates = [v.display_name, ...((v.legal_names || []) as string[])]
          .map(normalizeVendorName)
          .filter(n => n.length >= 4);
        for (const cand of candidates) {
          if (!haystacks.some(h => containsToken(h, cand))) continue;
          const count = countOf(receiptCounts, v.id);
          if (cand.length > bestLen || (cand.length === bestLen && count > bestCount)) {
            best = v;
            bestLen = cand.length;
            bestCount = count;
          }
        }
      }
      if (best) {
        console.log(`[vendorMatch] stage=brand-token vendor=${best.display_name} receipts=${bestCount}`);
        return best;
      }
    }
  }

  // 5. Fuzzy fallback on normalized names — guard against short names.
  //    Near-equal scores are decided by receipt volume.
  const needles = [extractedNorm, brandNorm].filter(n => n && n.length >= 4);
  if (needles.length > 0) {
    let bestScore = 0;
    let bestVendor: T | null = null;
    for (const v of vendors) {
      const candidates = [v.display_name, ...((v.legal_names || []) as string[])]
        .map(normalizeVendorName)
        .filter(n => n.length >= 4);
      for (const cand of candidates) {
        for (const needle of needles) {
          const score = nameSimilarity(needle, cand);
          if (score > bestScore + TIE_MARGIN) {
            bestScore = score;
            bestVendor = v;
          } else if (Math.abs(score - bestScore) <= TIE_MARGIN) {
            // Tie: prefer the vendor with more receipts, keep the better score.
            if (
              bestVendor &&
              v.id !== bestVendor.id &&
              countOf(receiptCounts, v.id) > countOf(receiptCounts, bestVendor.id)
            ) {
              bestVendor = v;
            } else if (!bestVendor) {
              bestVendor = v;
            }
            if (score > bestScore) bestScore = score;
          }
        }
      }
    }
    if (bestScore >= FUZZY_THRESHOLD && bestVendor) {
      console.log(
        `[vendorMatch] stage=fuzzy vendor=${bestVendor.display_name} score=${bestScore.toFixed(3)} receipts=${countOf(receiptCounts, bestVendor.id)}`,
      );
      return bestVendor;
    }
  }

  return null;
}

