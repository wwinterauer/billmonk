import type { Tables } from '@/integrations/supabase/types';

type Vendor = Tables<'vendors'>;

// Levenshtein Distance für String-Ähnlichkeit
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// Ähnlichkeit in Prozent (0-100)
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

// Überschneidung der erkannten Namen
function calculateDetectedNamesOverlap(names1: string[], names2: string[]): number {
  if (names1.length === 0 || names2.length === 0) return 0;

  let matches = 0;

  for (const name1 of names1) {
    for (const name2 of names2) {
      const sim = calculateSimilarity(name1, name2);
      if (sim >= 80) {
        matches++;
        break;
      }
    }
  }

  return Math.round((matches / Math.max(names1.length, names2.length)) * 100);
}

// Erweiterte Ähnlichkeitsprüfung für Lieferanten
export function calculateVendorSimilarity(
  vendor1: Vendor,
  vendor2: Vendor
): {
  score: number;
  matchReasons: string[];
} {
  const reasons: string[] = [];
  let totalScore = 0;
  let weights = 0;

  // 1. Display Name Ähnlichkeit (Gewicht: 40%)
  const displayNameSim = calculateSimilarity(vendor1.display_name, vendor2.display_name);
  totalScore += displayNameSim * 0.4;
  weights += 0.4;
  if (displayNameSim >= 80) reasons.push(`Ähnlicher Name (${displayNameSim}%)`);

  // 2. Legal Names Ähnlichkeit (Gewicht: 30%)
  const legalNames1 = vendor1.legal_names || [];
  const legalNames2 = vendor2.legal_names || [];
  if (legalNames1.length > 0 && legalNames2.length > 0) {
    let bestLegalSim = 0;
    for (const ln1 of legalNames1) {
      for (const ln2 of legalNames2) {
        const sim = calculateSimilarity(ln1, ln2);
        if (sim > bestLegalSim) bestLegalSim = sim;
      }
    }
    totalScore += bestLegalSim * 0.3;
    weights += 0.3;
    if (bestLegalSim >= 80) reasons.push(`Ähnlicher Firmenname (${bestLegalSim}%)`);
  }

  // 3. Detected Names Überschneidung (Gewicht: 30%)
  const detectedOverlap = calculateDetectedNamesOverlap(
    vendor1.detected_names || [],
    vendor2.detected_names || []
  );
  if (detectedOverlap > 0) {
    totalScore += detectedOverlap * 0.3;
    weights += 0.3;
    if (detectedOverlap >= 50) reasons.push('Gemeinsame erkannte Varianten');
  }

  // 4. Bonus: Beginnt mit gleichem Wort
  const firstWord1 = vendor1.display_name.split(/\s+/)[0]?.toLowerCase();
  const firstWord2 = vendor2.display_name.split(/\s+/)[0]?.toLowerCase();
  if (firstWord1 && firstWord2 && firstWord1 === firstWord2 && firstWord1.length > 2) {
    totalScore += 10;
    reasons.push('Gleiches erstes Wort');
  }

  // 5. Bonus: Gleiche Kategorie
  if (vendor1.default_category_id && vendor1.default_category_id === vendor2.default_category_id) {
    totalScore += 5;
    reasons.push('Gleiche Kategorie');
  }

  const finalScore = Math.min(100, Math.round(totalScore / (weights || 1)));

  return {
    score: finalScore,
    matchReasons: reasons,
  };
}

export interface VendorDuplicateCandidate {
  vendor: Vendor;
  matchingVendor: Vendor;
  score: number;
  matchReasons: string[];
}

// Duplikat-Kandidaten finden
export function findVendorDuplicates(
  vendors: Vendor[],
  minScore: number = 70
): VendorDuplicateCandidate[] {
  const duplicates: VendorDuplicateCandidate[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const vendor1 = vendors[i];
      const vendor2 = vendors[j];

      // Bereits verarbeitete Paare überspringen
      const pairKey = [vendor1.id, vendor2.id].sort().join('-');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const { score, matchReasons } = calculateVendorSimilarity(vendor1, vendor2);

      if (score >= minScore) {
        // Der mit mehr Belegen ist das "Original"
        const [original, duplicate] =
          (vendor1.receipt_count || 0) >= (vendor2.receipt_count || 0)
            ? [vendor1, vendor2]
            : [vendor2, vendor1];

        duplicates.push({
          vendor: duplicate,
          matchingVendor: original,
          score,
          matchReasons,
        });
      }
    }
  }

  // Nach Score sortieren (höchste zuerst)
  return duplicates.sort((a, b) => b.score - a.score);
}

// Schnelle Prüfung ob ein neuer Lieferantenname einem existierenden ähnlich ist
export function findSimilarVendor(
  newName: string,
  existingVendors: Vendor[],
  minScore: number = 75
): { vendor: Vendor; score: number } | null {
  let bestMatch: { vendor: Vendor; score: number } | null = null;

  for (const vendor of existingVendors) {
    // Check against display_name
    const displaySim = calculateSimilarity(newName, vendor.display_name);
    if (displaySim >= minScore && (!bestMatch || displaySim > bestMatch.score)) {
      bestMatch = { vendor, score: displaySim };
    }

    // Check against legal_names
    for (const legalName of vendor.legal_names || []) {
      const legalSim = calculateSimilarity(newName, legalName);
      if (legalSim >= minScore && (!bestMatch || legalSim > bestMatch.score)) {
        bestMatch = { vendor, score: legalSim };
      }
    }

    // Check against detected_names
    for (const detectedName of vendor.detected_names || []) {
      const detectedSim = calculateSimilarity(newName, detectedName);
      if (detectedSim >= minScore && (!bestMatch || detectedSim > bestMatch.score)) {
        bestMatch = { vendor, score: detectedSim };
      }
    }
  }

  return bestMatch;
}
