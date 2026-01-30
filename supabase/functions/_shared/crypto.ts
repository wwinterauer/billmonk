/**
 * Shared cryptographic utilities for edge functions
 * Uses AES-GCM encryption with PBKDF2 key derivation
 */

// Get encryption key from environment or derive from service role key
async function getEncryptionKey(): Promise<CryptoKey> {
  const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!encryptionSecret) {
    throw new Error("No encryption secret available");
  }
  
  // Use PBKDF2 to derive a proper AES key from the secret
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionSecret),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // Use a fixed salt (derived from project context) - in production, use a stored salt per user
  const salt = encoder.encode("lovable-email-encryption-v1");
  
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string using AES-GCM
 * Returns a base64 string containing IV + ciphertext
 */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a string encrypted with encryptString
 * Expects base64 string containing IV + ciphertext
 */
export async function decryptString(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Check if a string appears to be AES-GCM encrypted (has IV prefix)
 * vs simple Base64 encoding
 */
export function isAesEncrypted(value: string): boolean {
  try {
    const decoded = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    // AES-GCM encrypted values have 12-byte IV + at least 16-byte auth tag
    return decoded.length >= 28;
  } catch {
    return false;
  }
}

/**
 * Decrypt password with backward compatibility for Base64-encoded passwords
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  // Check if this looks like old Base64-only encoding (no IV prefix)
  // Old Base64 passwords decode to short strings, AES-GCM has 12-byte IV + 16-byte tag minimum
  try {
    const decoded = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    
    // If less than 28 bytes, it's likely old Base64 encoding
    if (decoded.length < 28) {
      console.log("[crypto] Using legacy Base64 decoding");
      return atob(encrypted);
    }
    
    // Try AES-GCM decryption
    console.log("[crypto] Using AES-GCM decryption");
    return await decryptString(encrypted);
  } catch (error) {
    // Fallback to legacy Base64 for any errors
    console.log("[crypto] Falling back to legacy Base64 decoding");
    return atob(encrypted);
  }
}
