export type CvParseJobSnapshot = {
  jobId?: string;
  status?: string;
  data?: Record<string, unknown> | null;
  error?: string;
};

const DEFAULT_INTERVAL_MS = 800;
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;
/** Absolute cap from first poll — a job stuck in any state still errors. */
const HARD_CAP_MS = 30 * 60 * 1000;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** Poll until queued CV parse is done or failed. */
export async function waitForCvParseJob(
  jobId: string,
  options: {
    getJob: (id: string) => Promise<CvParseJobSnapshot | null>;
    signal?: AbortSignal;
    intervalMs?: number;
    timeoutMs?: number;
    now?: () => number;
    wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  },
): Promise<Record<string, unknown>> {
  const id = String(jobId || '').trim();
  if (!id) throw new Error('Parse job id is missing');

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const wait = options.wait ?? sleep;
  const started = now();
  let idleStart = started;

  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const t = now();
    if (t - started > HARD_CAP_MS || t - idleStart > timeoutMs) {
      throw new Error('Resume parse timed out. Try again.');
    }

    const job = await options.getJob(id);
    const status = String(job?.status || '').toLowerCase();
    if (status === 'done') {
      return (job?.data && typeof job.data === 'object' ? job.data : {}) as Record<string, unknown>;
    }
    if (status === 'error') {
      throw new Error(job?.error || 'Could not parse resume. Try again.');
    }
    // A human is on the duplicate popup — do not count that wait as idle time.
    if (status === 'waiting_user') {
      idleStart = t;
    }

    await wait(intervalMs, options.signal);
  }
}
