// Upload queue that lives outside React state so re-renders, closures or a
// remount of the upload page can never drop queued files. Every run ends in a
// final state: once the queue is empty, nothing is running and no hold (e.g.
// an open duplicate dialog) remains, `onDrained` is called exactly once.

export interface UploadTask {
  id: string;
  run: () => Promise<void>;
}

export interface UploadControllerOptions {
  concurrency?: number;
  onDrained: () => void | Promise<void>;
  onTaskError?: (id: string, error: unknown) => void | Promise<void>;
  now?: () => number;
}

export class UploadController {
  private readonly concurrency: number;
  private readonly opts: UploadControllerOptions;
  private readonly now: () => number;
  private queue: UploadTask[] = [];
  private running = new Map<string, UploadTask>();
  private attempts = new Map<string, number>();
  private holds = new Set<string>(['setup']);
  private finished = false;
  lastProgressAt: number;

  constructor(opts: UploadControllerOptions) {
    this.opts = opts;
    this.concurrency = Math.max(1, opts.concurrency ?? 3);
    this.now = opts.now ?? Date.now;
    this.lastProgressAt = this.now();
  }

  get isFinished() { return this.finished; }
  get pendingCount() { return this.queue.length + this.running.size; }
  get runningCount() { return this.running.size; }

  touch() { this.lastProgressAt = this.now(); }

  /** Keeps the run open (e.g. while the user decides on duplicates). */
  hold(key: string) {
    if (this.finished) return;
    this.holds.add(key);
  }

  release(key: string) {
    this.holds.delete(key);
    this.pump();
  }

  enqueue(tasks: UploadTask[]) {
    if (this.finished) throw new Error('Upload-Lauf ist bereits abgeschlossen');
    this.queue.push(...tasks);
    this.touch();
    this.pump();
  }

  isStalled(thresholdMs: number) {
    return !this.finished && this.pendingCount > 0 && this.now() - this.lastProgressAt >= thresholdMs;
  }

  /** Re-start tasks that appear hung. Late results of the old attempt are ignored. */
  resume() {
    const hung = Array.from(this.running.values());
    this.running.clear();
    this.queue.unshift(...hung);
    this.touch();
    this.pump();
  }

  private pump() {
    while (!this.finished && this.running.size < this.concurrency && this.queue.length > 0) {
      this.start(this.queue.shift()!);
    }
    if (!this.finished && this.running.size === 0 && this.queue.length === 0 && this.holds.size === 0) {
      this.finished = true;
      Promise.resolve()
        .then(() => this.opts.onDrained())
        .catch(error => console.error('Upload run finalisation failed:', error));
    }
  }

  private start(task: UploadTask) {
    const attempt = (this.attempts.get(task.id) ?? 0) + 1;
    this.attempts.set(task.id, attempt);
    this.running.set(task.id, task);
    this.touch();
    const isStale = () => this.attempts.get(task.id) !== attempt || this.running.get(task.id) !== task;
    Promise.resolve()
      .then(() => task.run())
      .catch(async error => {
        if (isStale()) return;
        try { await this.opts.onTaskError?.(task.id, error); } catch (e) { console.error(e); }
      })
      .finally(() => {
        if (isStale()) return;
        this.running.delete(task.id);
        this.touch();
        this.pump();
      });
  }
}

// Registries live on globalThis so they survive an unmount of the upload page
// (SPA navigation) and hot module reloads while a run is still in progress.
const g = globalThis as typeof globalThis & {
  __billmonkLiveUploadRuns?: Map<string, UploadController>;
  __billmonkLiveRunIds?: Set<string>;
};

/** Controller per run, available once the upload phase has started. */
export const liveUploadRuns: Map<string, UploadController> = (g.__billmonkLiveUploadRuns ??= new Map());

/** Every run started in this browser tab, from file selection until it is finalised. */
export const liveRunIds: Set<string> = (g.__billmonkLiveRunIds ??= new Set());

/** A run with protocol activity this recent is still being worked on somewhere. */
export const RUN_ACTIVITY_GRACE_MS = 3 * 60 * 1000;

export function isRunInterrupted(params: {
  runId: string;
  lastActivityAt: string | null;
  now?: number;
  liveIds?: Set<string>;
}): boolean {
  const live = params.liveIds ?? liveRunIds;
  if (live.has(params.runId)) return false;
  if (!params.lastActivityAt) return true;
  const age = (params.now ?? Date.now()) - new Date(params.lastActivityAt).getTime();
  return age >= RUN_ACTIVITY_GRACE_MS;
}
