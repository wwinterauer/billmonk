export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Fetches a (cross-origin) URL into a Blob and saves it locally so Chrome doesn't block it. */
export async function downloadFromUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    downloadBlob(await res.blob(), filename);
  } catch {
    window.open(url, '_blank');
  }
}
