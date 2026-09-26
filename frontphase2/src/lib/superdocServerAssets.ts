import { createRequire } from 'node:module';
import { readFile, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_FILES = {
  style: 'style.css',
  document: 'document-worker.js',
  review: 'review-worker.js',
} as const;

const WORKER_PREFIX = {
  document: 'browser-worker-entry-',
  review: 'review-index-worker-entry-',
} as const;

function candidateRoots(): string[] {
  const cwd = process.cwd();
  return [cwd, path.join(cwd, 'frontphase2'), path.join(cwd, 'hrayntra_aws', 'frontphase2')];
}

async function readFirst(paths: string[]): Promise<Buffer | null> {
  for (const filePath of paths) {
    try {
      return await readFile(filePath);
    } catch {
      // Try the next location. Standalone and monorepo layouts differ.
    }
  }
  return null;
}

function publicPaths(fileName: string): string[] {
  return candidateRoots().map((root) => path.join(root, 'public', 'superdoc', fileName));
}

export async function readSuperdocStyle(): Promise<Buffer | null> {
  const fromPublic = await readFirst(publicPaths(PUBLIC_FILES.style));
  if (fromPublic) return fromPublic;

  for (const root of candidateRoots()) {
    try {
      const require = createRequire(path.join(root, 'package.json'));
      const entry = await realpath(require.resolve('superdoc'));
      const distDir = path.dirname(entry);
      const shell = await readFile(path.join(distDir, 'style.css'), 'utf8');
      const engine = await readFile(
        path.join(distDir, '..', '..', '@superdoc', 'docx-engine', 'dist', 'style.css'),
        'utf8',
      );
      const css = shell.replace(
        /@import\s+["']@superdoc\/docx-engine\/style\.css["']\s*;/,
        () => engine,
      );
      return Buffer.from(css);
    } catch {
      // This root is not the app that installed superdoc.
    }
  }
  return null;
}

export async function readSuperdocWorker(kind: keyof typeof WORKER_PREFIX): Promise<Buffer | null> {
  const fromPublic = await readFirst(publicPaths(PUBLIC_FILES[kind]));
  if (fromPublic) return fromPublic;

  for (const root of candidateRoots()) {
    try {
      const require = createRequire(path.join(root, 'package.json'));
      const entry = await realpath(require.resolve('superdoc'));
      const assetsDir = path.join(
        path.dirname(entry),
        '..',
        '..',
        '@superdoc',
        'docx-engine',
        'dist',
        'assets',
      );
      const name = (await readdir(assetsDir)).find(
        (file) => file.startsWith(WORKER_PREFIX[kind]) && file.endsWith('.js'),
      );
      if (!name) continue;
      return await readFile(path.join(assetsDir, name));
    } catch {
      // This root is not the app that installed superdoc.
    }
  }
  return null;
}
