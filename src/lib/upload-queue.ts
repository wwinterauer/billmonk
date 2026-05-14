// Persists in-progress upload metadata to localStorage so we can show a
// recovery hint if the page is reloaded mid-upload. We cannot persist the
// File objects themselves (too large, no API), but we can remember which
// filenames were planned vs. which actually completed.

const VERSION = 1;
const KEY_PREFIX = 'billmonk:upload-queue:v' + VERSION + ':';

export interface UploadQueueItem {
  fileName: string;
  fileSize: number;
  fileHash?: string;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
}

export interface UploadQueueState {
  startedAt: number;
  total: number;
  items: UploadQueueItem[];
}

function keyFor(userId: string) {
  return KEY_PREFIX + userId;
}

export function saveQueue(userId: string, state: UploadQueueState): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Quota or disabled — non-fatal.
  }
}

export function loadQueue(userId: string): UploadQueueState | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UploadQueueState;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearQueue(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

/** Run an async task per item with a fixed concurrency limit, preserving order of completion callbacks per slot. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        await worker(items[i], i);
      } catch {
        // worker is responsible for its own error reporting
      }
    }
  });
  await Promise.all(runners);
}
