import { describe, expect, it, vi } from 'vitest';
import { prepareUploadFiles } from '@/lib/uploadPreparation';

describe('upload preparation', () => {
  it('bounds concurrent reads for 205 files and reports actual completions', async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    const files = Array.from({ length: 205 }, (_, i) => i);
    const result = await prepareUploadFiles(files, async i => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return i;
    }, (_, count) => { completed.push(count); });
    expect(peak).toBe(3);
    expect(result).toEqual(files);
    expect(completed).toEqual(files.map(i => i + 1));
  });

  it('fails rather than silently hanging on an unreadable file', async () => {
    vi.useFakeTimers();
    try {
      const result = prepareUploadFiles([1], () => new Promise<number>(() => {}));
      const assertion = expect(result).rejects.toThrow('Dateiprüfung hat zu lange gedauert');
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it('propagates read errors to the upload error handler', async () => {
    await expect(prepareUploadFiles([1], async () => { throw new Error('unreadable'); }))
      .rejects.toThrow('unreadable');
  });
});