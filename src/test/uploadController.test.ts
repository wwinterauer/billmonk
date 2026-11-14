import { describe, it, expect, vi } from 'vitest';
import { UploadController } from '@/lib/uploadController';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};

describe('UploadController', () => {
  it('starts new files while duplicate decisions are still open', async () => {
    const started: string[] = [];
    const onDrained = vi.fn();
    const c = new UploadController({ onDrained });
    c.hold('duplicates');
    c.enqueue(['a', 'b'].map(id => ({ id, run: async () => { started.push(id); } })));
    c.release('setup');
    await flush();
    expect(started).toEqual(['a', 'b']);
    expect(onDrained).not.toHaveBeenCalled();
    c.release('duplicates');
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('keeps going when one file fails and reports the error', async () => {
    const done: string[] = [];
    const onTaskError = vi.fn();
    const onDrained = vi.fn();
    const c = new UploadController({ onDrained, onTaskError, concurrency: 1 });
    c.enqueue([
      { id: 'a', run: async () => { throw new Error('kaputt'); } },
      { id: 'b', run: async () => { done.push('b'); } },
    ]);
    c.release('setup');
    await flush(); await flush();
    expect(onTaskError).toHaveBeenCalledWith('a', expect.any(Error));
    expect(done).toEqual(['b']);
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('finishes the run even when nothing is left to upload', async () => {
    const onDrained = vi.fn();
    const c = new UploadController({ onDrained });
    c.release('setup');
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
    expect(c.isFinished).toBe(true);
  });

  it('never runs more than 3 uploads at once', async () => {
    let active = 0; let peak = 0;
    const c = new UploadController({ onDrained: () => {}, concurrency: 3 });
    c.enqueue(Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      run: async () => { active++; peak = Math.max(peak, active); await flush(); active--; },
    })));
    c.release('setup');
    for (let i = 0; i < 20; i++) await flush();
    expect(peak).toBe(3);
  });

  it('flags a stall after 2 minutes without progress and resume restarts the hung file', async () => {
    let time = 0;
    const hung = deferred();
    let attempts = 0;
    const onDrained = vi.fn();
    const c = new UploadController({ onDrained, now: () => time });
    c.enqueue([{ id: 'a', run: () => { attempts++; return attempts === 1 ? hung.promise : Promise.resolve(); } }]);
    c.release('setup');
    await flush();
    time = 119_000;
    expect(c.isStalled(120_000)).toBe(false);
    time = 120_000;
    expect(c.isStalled(120_000)).toBe(true);
    c.resume();
    await flush(); await flush();
    expect(attempts).toBe(2);
    expect(onDrained).toHaveBeenCalledTimes(1);
    hung.resolve(); // late result of the old attempt is ignored
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });
});

import { isRunInterrupted } from '@/lib/uploadController';

describe('isRunInterrupted', () => {
  const now = new Date('2026-11-14T13:00:00Z').getTime();
  it('never treats a run started in this tab as interrupted', () => {
    expect(isRunInterrupted({ runId: 'r1', lastActivityAt: '2026-11-14T12:00:00Z', now, liveIds: new Set(['r1']) })).toBe(false);
  });
  it('keeps a run with activity in the last 3 minutes alive (background or other tab)', () => {
    expect(isRunInterrupted({ runId: 'r1', lastActivityAt: '2026-11-14T12:57:30Z', now, liveIds: new Set() })).toBe(false);
  });
  it('marks a run without activity for 3 minutes as interrupted', () => {
    expect(isRunInterrupted({ runId: 'r1', lastActivityAt: '2026-11-14T12:57:00Z', now, liveIds: new Set() })).toBe(true);
  });
});
