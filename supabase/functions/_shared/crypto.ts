/**
 * Shared cryptographic utilities for edge functions
 * Uses AES-GCM encryption with PBKDF2 key derivation
 * 
 * Format v2: "base64(salt):base64(iv+ciphertext)" — per-encryption random salt
 * Format v1 (legacy): "base64(iv+ciphertext)" — fixed global salt
 */

const LEGACY_SALT = new TextEncoder().encode("lovable-email-encryption-v1");

// Get encryption key from environment, derived with the provided salt
async function getEncryptionKey(salt: Uint8Array): Promise<CryptoKey> {
  const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!encryptionSecret) {
    throw new Error("No encryption secret available");
  }
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionSecret),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
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
 * Encrypts a string using AES-GCM with a random per-encryption salt.
 * Returns "base64(salt):base64(iv+ciphertext)"
 */
export async function encryptString(plaintext: string): Promise<string> {
  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await getEncryptionKey(salt);
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
  
  const saltB64 = btoa(String.fromCharCode(...salt));
  const payloadB64 = btoa(String.fromCharCode(...combined));
  
  return `${saltB64}:${payloadB64}`;
}

/**
 * Decrypts a string encrypted with encryptString.
 * Supports both v2 ("salt:payload") and v1 legacy ("payload") formats.
 */
export async function decryptString(encrypted: string): Promise<string> {
  let salt: Uint8Array;
  let payloadB64: string;
  
  const colonIndex = encrypted.indexOf(':');
  if (colonIndex > 0 && colonIndex < encrypted.length - 1) {
    // v2 format: "base64(salt):base64(iv+ciphertext)"
    const saltB64 = encrypted.substring(0, colonIndex);
    payloadB64 = encrypted.substring(colonIndex + 1);
    salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    console.log("[crypto] Using per-encryption salt (v2)");
  } else {
    // v1 legacy format: "base64(iv+ciphertext)" with fixed salt
    payloadB64 = encrypted;
    salt = LEGACY_SALT;
    console.log("[crypto] Using legacy fixed salt (v1)");
  }
  
  const key = await getEncryptionKey(salt);
  const combined = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
  
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
 * Check if a string appears to be AES-GCM encrypted
 */
export function isAesEncrypted(value: string): boolean {
  try {
    const colonIndex = value.indexOf(':');
    if (colonIndex > 0 && colonIndex < value.length - 1) {
      // v2 format — check payload part
      const payloadB64 = value.substring(colonIndex + 1);
      const decoded = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
      return decoded.length >= 28;
    }
    // v1 legacy format
    const decoded = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return decoded.length >= 28;
  } catch {
    return false;
  }
}

/**
 * Decrypt password with backward compatibility for Base64-encoded passwords
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  try {
    // v2 format always has colon — use AES-GCM
    if (encrypted.indexOf(':') > 0) {
      console.log("[crypto] Using AES-GCM decryption (v2)");
      return await decryptString(encrypted);
    }
    
    // v1: check payload length
    const decoded = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    
    // If less than 28 bytes, it's likely old Base64 encoding
    if (decoded.length < 28) {
      console.log("[crypto] Using legacy Base64 decoding");
      return atob(encrypted);
    }
    
    // Try AES-GCM decryption with legacy salt
    console.log("[crypto] Using AES-GCM decryption (v1)");
    return await decryptString(encrypted);
  } catch (error) {
    // Fallback to legacy Base64 for any errors
    console.log("[crypto] Falling back to legacy Base64 decoding");
    return atob(encrypted);
  }
}
