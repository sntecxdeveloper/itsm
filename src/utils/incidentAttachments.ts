export interface Attachment {
  name: string;
  type: string;
  size: number;
  /** The file itself as a data: URL. */
  data: string;
}

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_TOTAL_BYTES = 3_000_000;

// The backend has no attachment storage yet: attachments are kept in this browser, per incident.
export const attachmentsKey = (id: number) => `dex.incident.attachments.${id}`;

export function loadAttachments(id: number): Attachment[] {
  try {
    return JSON.parse(localStorage.getItem(attachmentsKey(id)) ?? '[]') as Attachment[];
  } catch {
    return [];
  }
}

/** Returns false when the browser refused the write (storage full or unavailable). */
export function saveAttachments(id: number, list: Attachment[]): boolean {
  try {
    if (list.length) localStorage.setItem(attachmentsKey(id), JSON.stringify(list));
    else localStorage.removeItem(attachmentsKey(id));
    return true;
  } catch {
    return false;
  }
}

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Reads dropped files into attachments, skipping any that are too big. Returns what was added and a message for the rest. */
export async function readAttachments(
  files: File[],
  existing: Attachment[],
): Promise<{ added: Attachment[]; note: string | null }> {
  const added: Attachment[] = [];
  const skipped: string[] = [];
  let total = existing.reduce((sum, a) => sum + a.size, 0);
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES || total + f.size > MAX_TOTAL_BYTES) {
      skipped.push(f.name);
      continue;
    }
    added.push({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, data: await toDataUrl(f) });
    total += f.size;
  }
  return {
    added,
    note: skipped.length ? `Not added: ${skipped.join(', ')}. Each file can be up to 1 MB and all files together up to 3 MB.` : null,
  };
}

export const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`);
