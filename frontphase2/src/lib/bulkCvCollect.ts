/** Accepted CV extensions for bulk upload (lowercase). */
const BULK_CV_EXT = new Set(['.pdf', '.doc', '.docx']);

export function isBulkCvFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return BULK_CV_EXT.has(lower.slice(dot));
}

/** Skip macOS metadata / hidden paths inside folder uploads. */
export function shouldSkipBulkCvPath(filePath: string): boolean {
  const p = String(filePath || '').replace(/\\/g, '/');
  if (!p || p.startsWith('.')) return true;
  if (p.includes('/__MACOSX/') || p.startsWith('__MACOSX/')) return true;
  if (p.endsWith('.DS_Store')) return true;
  return false;
}

export function filterBulkCvFiles(files: File[]): File[] {
  return files.filter((f) => {
    if (!f?.name || shouldSkipBulkCvPath(f.name)) return false;
    return isBulkCvFileName(f.name);
  });
}

type FileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file: (cb: (file: File) => void) => void;
  createReader: () => { readEntries: (cb: (entries: FileSystemEntry[]) => void) => void };
};

function readEntryFiles(entry: FileSystemEntry, pathPrefix: string): Promise<File[]> {
  return new Promise((resolve, reject) => {
    if (entry.isFile) {
      entry.file((file) => {
        const relative = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
        try {
          const wrapped = new File([file], relative, {
            type: file.type,
            lastModified: file.lastModified,
          });
          resolve([wrapped]);
        } catch {
          resolve([file]);
        }
      }, reject);
      return;
    }
    if (!entry.isDirectory) {
      resolve([]);
      return;
    }
    const reader = entry.createReader();
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (!entries.length) {
          try {
            const nested = await Promise.all(
              all.map((child) =>
                readEntryFiles(child, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name)
              )
            );
            resolve(nested.flat());
          } catch (e) {
            reject(e);
          }
          return;
        }
        all.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

/** Collect all CV files from a drag-and-drop (files or folders). */
export async function collectBulkCvFilesFromDataTransfer(
  dataTransfer: DataTransfer | null | undefined
): Promise<File[]> {
  if (!dataTransfer) return [];
  const items = dataTransfer.items;
  if (!items?.length) {
    return filterBulkCvFiles(Array.from(dataTransfer.files || []));
  }

  const gathered: File[] = [];
  const tasks: Promise<File[]>[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.() as FileSystemEntry | null | undefined;
    if (entry) {
      tasks.push(readEntryFiles(entry, ''));
      continue;
    }
    const f = item.getAsFile();
    if (f) gathered.push(f);
  }

  const nested = tasks.length ? (await Promise.all(tasks)).flat() : [];
  return filterBulkCvFiles([...gathered, ...nested]);
}
