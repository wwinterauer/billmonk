/**
 * Efficient Uint8Array to Base64 conversion.
 * Uses Array.join() instead of string concatenation to avoid O(n²) performance.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  const binChars: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binChars.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  return btoa(binChars.join(''));
}
