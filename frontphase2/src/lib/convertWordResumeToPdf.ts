import { createHash } from 'node:crypto';
import { editDocxTextBytes } from './editDocxText';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const cacheDir = path.join(tmpdir(), 'hryantra-word-pdf');
const workerScriptPath = path.join(cacheDir, 'word-export-worker.ps1');
let conversionQueue: Promise<unknown> = Promise.resolve();

const WORKER_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.ScreenUpdating = $false
} catch {
  [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  [Console]::Out.Flush()
  exit 1
}
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq '') { continue }
  if ($line -eq 'QUIT') { break }
  $tab = $line.IndexOf([char]9)
  if ($tab -lt 1) {
    [Console]::Out.WriteLine('ERR bad request')
    [Console]::Out.Flush()
    continue
  }
  $docxPath = $line.Substring(0, $tab)
  $pdfPath = $line.Substring($tab + 1)
  $doc = $null
  try {
    if (Test-Path -LiteralPath $pdfPath) { Remove-Item -LiteralPath $pdfPath -Force }
    $doc = $word.Documents.Open($docxPath, $false, $true, $false)
    $doc.SaveAs2($pdfPath, 17)
    $doc.Close(0)
    $doc = $null
    [Console]::Out.WriteLine('OK')
  } catch {
    if ($doc -ne $null) {
      try { $doc.Close(0) | Out-Null } catch {}
      $doc = $null
    }
    [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  }
  [Console]::Out.Flush()
}
if ($word -ne $null) {
  try { $word.Quit() | Out-Null } catch {}
}
`;

type WordWaiter = { resolve: () => void; reject: (error: Error) => void };

type WordWorkerState = {
  proc: ChildProcessWithoutNullStreams | null;
  ready: Promise<void> | null;
  waiters: WordWaiter[];
  expecting: boolean;
};

const workerState: WordWorkerState = ((globalThis as { __hryantraWordWorker?: WordWorkerState })
  .__hryantraWordWorker ??= {
  proc: null,
  ready: null,
  waiters: [],
  expecting: false,
});

function failWaiters(error: Error) {
  workerState.expecting = false;
  const pending = workerState.waiters.splice(0);
  for (const waiter of pending) waiter.reject(error);
}

function stopWordWorker() {
  const proc = workerState.proc;
  workerState.proc = null;
  workerState.ready = null;
  failWaiters(new Error('Word preview stopped'));
  if (!proc || proc.killed) return;
  try {
    proc.stdin.write('QUIT\n');
  } catch {
    /* already closed */
  }
  proc.kill();
}

async function ensureWordWorker(): Promise<void> {
  if (workerState.proc && workerState.proc.exitCode === null && workerState.ready) {
    return workerState.ready;
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(workerScriptPath, WORKER_SCRIPT, 'utf8');
  const proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', workerScriptPath],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
  );
  workerState.proc = proc;
  workerState.expecting = false;
  workerState.ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Word took too long to start'));
      stopWordWorker();
    }, 60000);
    const rl = readline.createInterface({ input: proc.stdout });
    let ready = false;
    rl.on('line', (line) => {
      const text = line.trim();
      if (!text) return;
      if (!ready) {
        if (text === 'READY') {
          ready = true;
          clearTimeout(timer);
          resolve();
        } else if (text.startsWith('ERR')) {
          clearTimeout(timer);
          reject(new Error(text.slice(4).trim() || 'Word failed to start'));
        }
        return;
      }
      if (!workerState.expecting) return;
      if (text !== 'OK' && !text.startsWith('ERR')) return;
      workerState.expecting = false;
      const waiter = workerState.waiters.shift();
      if (!waiter) return;
      if (text === 'OK') waiter.resolve();
      else waiter.reject(new Error(text.slice(4).trim() || 'Word export failed'));
    });
    proc.on('exit', () => {
      clearTimeout(timer);
      rl.close();
      if (workerState.proc === proc) {
        workerState.proc = null;
        workerState.ready = null;
      }
      failWaiters(new Error('Word closed unexpectedly'));
    });
  });
  return workerState.ready;
}

/** Start Microsoft Word in the background so the next page redraw does not pay startup time. */
export function warmWordExporter(): void {
  void ensureWordWorker().catch(() => undefined);
}

function exportWithRunningWord(docxPath: string, pdfPath: string): Promise<void> {
  const proc = workerState.proc;
  if (!proc || proc.exitCode !== null) {
    return Promise.reject(new Error('Word is not running'));
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Word export timed out'));
      stopWordWorker();
    }, 45000);
    workerState.waiters.push({
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    workerState.expecting = true;
    proc.stdin.write(`${docxPath}\t${pdfPath}\n`, (error) => {
      if (!error) return;
      clearTimeout(timer);
      workerState.expecting = false;
      workerState.waiters.pop();
      reject(error);
    });
  });
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = conversionQueue.then(task, task);
  conversionQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function exportDocxWithWord(docxPath: string, pdfPath: string): Promise<void> {
  try {
    await ensureWordWorker();
    await exportWithRunningWord(docxPath, pdfPath);
    return;
  } catch {
    stopWordWorker();
  }
  const scriptPath = path.join(cacheDir, `export-${process.pid}-${Date.now()}.ps1`);
  const script = `
$ErrorActionPreference = 'Stop'
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.ScreenUpdating = $false
  $doc = $word.Documents.Open('${docxPath.replace(/'/g, "''")}', $false, $true, $false)
  $doc.SaveAs2('${pdfPath.replace(/'/g, "''")}', 17)
  $doc.Close(0)
  $doc = $null
} finally {
  if ($doc -ne $null) { $doc.Close(0) | Out-Null }
  if ($word -ne $null) { $word.Quit() | Out-Null }
}
`;
  await writeFile(scriptPath, script, 'utf8');
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 120000, windowsHide: true }
    );
  } finally {
    await unlink(scriptPath).catch(() => undefined);
  }
}

function urlPdfCachePath(sourceUrl: string): string {
  const hash = createHash('sha256').update(sourceUrl).digest('hex');
  return path.join(cacheDir, `url-${hash}.pdf`);
}

/** PDF already rendered for this resume URL. Skips downloading the Word file again. */
export async function readCachedWordPdfForUrl(sourceUrl: string): Promise<Uint8Array | null> {
  try {
    const cached = await readFile(urlPdfCachePath(sourceUrl));
    if (cached.byteLength > 1000) return new Uint8Array(cached);
  } catch {
    /* convert */
  }
  return null;
}

export async function rememberWordPdfForUrl(sourceUrl: string, pdf: Uint8Array): Promise<void> {
  if (pdf.byteLength < 1000) return;
  await mkdir(cacheDir, { recursive: true });
  await writeFile(urlPdfCachePath(sourceUrl), pdf);
}

/** Render a Word resume with Microsoft Word and return the PDF bytes. */
export async function convertWordResumeToPdf(docxBytes: Uint8Array): Promise<Uint8Array> {
  const hash = createHash('sha256').update(docxBytes).digest('hex');
  const pdfPath = path.join(cacheDir, `${hash}.pdf`);
  const docxPath = path.join(cacheDir, `${hash}.docx`);
  await mkdir(cacheDir, { recursive: true });
  try {
    const cached = await readFile(pdfPath);
    if (cached.byteLength > 1000) return new Uint8Array(cached);
  } catch {
    /* convert */
  }
  return enqueue(async () => {
    try {
      const cached = await readFile(pdfPath);
      if (cached.byteLength > 1000) return new Uint8Array(cached);
    } catch {
      /* convert */
    }
    await writeFile(docxPath, docxBytes);
    await exportDocxWithWord(docxPath, pdfPath);
    const pdf = await readFile(pdfPath);
    if (pdf.byteLength < 1000) {
      throw new Error('Word did not produce a PDF');
    }
    return new Uint8Array(pdf);
  });
}

export type WordTextReplacement = { from: string; to: string };

/** Apply text edits inside the real .docx with Microsoft Word. */
export async function applyWordTextEdits(
  docxBytes: Uint8Array,
  replacements: WordTextReplacement[]
): Promise<{ docx: Uint8Array; applied: number; missed: string[] }> {
  const usable = replacements.filter((item) => item.from.trim() && item.from !== item.to);
  if (!usable.length) {
    return { docx: docxBytes, applied: 0, missed: [] };
  }
  const direct = editDocxTextBytes(docxBytes, usable);
  if (direct.applied > 0 && direct.missed.length === 0) {
    return direct;
  }
  const pending = direct.applied > 0 ? usable.filter((item) => direct.missed.includes(item.from)) : usable;
  const baseBytes = direct.applied > 0 ? direct.docx : docxBytes;
  const hash = createHash('sha256')
    .update(baseBytes)
    .update(JSON.stringify(pending))
    .digest('hex');
  await mkdir(cacheDir, { recursive: true });
  const docxPath = path.join(cacheDir, `${hash}-edit.docx`);
  const jsonPath = path.join(cacheDir, `${hash}-edit.json`);
  const resultPath = path.join(cacheDir, `${hash}-edit-result.json`);
  const scriptPath = path.join(cacheDir, `${hash}-edit.ps1`);
  await writeFile(docxPath, baseBytes);
  await writeFile(jsonPath, JSON.stringify(pending), 'utf8');
  const script = `
$ErrorActionPreference = 'Stop'
$word = $null
$doc = $null
$applied = 0
$missed = @()
try {
  $items = Get-Content -LiteralPath '${jsonPath.replace(/'/g, "''")}' -Raw -Encoding UTF8 | ConvertFrom-Json
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open('${docxPath.replace(/'/g, "''")}', $false, $false, $false)
  foreach ($item in @($items)) {
    $find = $doc.Content.Find
    $find.ClearFormatting() | Out-Null
    $find.Replacement.ClearFormatting() | Out-Null
    $from = [string]$item.from
    $to = [string]$item.to
    $ok = $find.Execute($from, $true, $false, $false, $false, $false, $true, 1, $false, $to, 2)
    if ($ok) { $applied++ } else { $missed += $from }
  }
  $doc.Save()
  $doc.Close(0)
  $doc = $null
} finally {
  if ($doc -ne $null) { $doc.Close(0) | Out-Null }
  if ($word -ne $null) { $word.Quit() | Out-Null }
}
@{ applied = $applied; missed = @($missed) } | ConvertTo-Json | Set-Content -LiteralPath '${resultPath.replace(/'/g, "''")}' -Encoding UTF8
`;
  await writeFile(scriptPath, script, 'utf8');
  return enqueue(async () => {
    try {
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 120000, windowsHide: true }
      );
      const docx = new Uint8Array(await readFile(docxPath));
      let applied = 0;
      let missed: string[] = [];
      try {
        const result = JSON.parse(await readFile(resultPath, 'utf8')) as {
          applied?: number;
          missed?: string[] | string;
        };
        applied = Number(result.applied || 0);
        missed = Array.isArray(result.missed) ? result.missed : result.missed ? [result.missed] : [];
      } catch {
        applied = 0;
      }
      if (docx.byteLength < 1000) throw new Error('Word did not save the document');
      return { docx, applied: direct.applied + applied, missed };
    } finally {
      await unlink(scriptPath).catch(() => undefined);
    }
  });
}
