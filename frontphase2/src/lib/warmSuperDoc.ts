'use client';

export const SUPERDOC_DOCUMENT_WORKER = '/superdoc/document-worker.js?v=5';

const WARM_READY_MS = 20000;

let enginePromise: Promise<typeof import('superdoc')> | null = null;
let warmWorker: Worker | null = null;
let warmStartedAt = 0;
let warmReady = false;
let warmTimer = 0;

function scheduleEngineImport(): void {
  if (enginePromise) return;
  const start = () => {
    if (!enginePromise) enginePromise = import('superdoc');
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === 'function') {
    idle(start, { timeout: 2500 });
  } else {
    window.setTimeout(start, 400);
  }
}

/** Compile SuperDoc's document worker before the DOCX tab is opened. */
export function warmSuperDoc(): void {
  if (typeof window === 'undefined') return;
  scheduleEngineImport();
  if (warmWorker || warmReady) return;
  try {
    warmStartedAt = performance.now();
    warmWorker = new Worker(SUPERDOC_DOCUMENT_WORKER, {
      type: 'module',
      name: 'superdoc-v2-warm',
    });
    warmTimer = window.setTimeout(() => {
      warmReady = true;
      warmWorker?.terminate();
      warmWorker = null;
    }, WARM_READY_MS);
    warmWorker.addEventListener(
      'error',
      () => {
        window.clearTimeout(warmTimer);
        warmWorker?.terminate();
        warmWorker = null;
        warmReady = false;
      },
      { once: true }
    );
  } catch {
    warmWorker = null;
    warmReady = false;
  }
}

export function loadSuperDocModule(): Promise<typeof import('superdoc')> {
  if (typeof window === 'undefined') return import('superdoc');
  if (!enginePromise) enginePromise = import('superdoc');
  return enginePromise;
}

/**
 * Drop the idle warm worker before SuperDoc opens its own.
 * If the warm worker already finished compiling, the next worker reuses that code.
 * If it is still compiling, stop it so two copies do not parse the same script.
 */
export function releaseSuperDocWarmWorker(): void {
  if (!warmWorker) return;
  const age = performance.now() - warmStartedAt;
  window.clearTimeout(warmTimer);
  warmWorker.terminate();
  warmWorker = null;
  warmReady = age >= WARM_READY_MS;
}
