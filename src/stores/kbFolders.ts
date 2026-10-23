export type KbFolderType = 'KB_ARTICLES' | 'SCRIPTS';

export interface KbFolder {
  id: string;
  name: string;
  type: KbFolderType;
  createdAt: number;
  /** ids of articles/scripts placed inside this folder */
  itemIds: string[];
}

const FOLDERS_KEY = 'kb_folders';

function loadFolders(): KbFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // migrate old folders that had no itemIds
    return parsed.map((f) => ({ ...f, itemIds: Array.isArray(f.itemIds) ? f.itemIds : [] }));
  } catch {
    return [];
  }
}

function saveFolders(next: KbFolder[]) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

let folders: KbFolder[] = loadFolders();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Subscribe to folder changes; returns unsubscribe function (for useSyncExternalStore). */
export function subscribeFolders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFolders(): KbFolder[] {
  return folders;
}

export function getFoldersByType(type: KbFolderType): KbFolder[] {
  return folders.filter((folder) => folder.type === type);
}

export function createFolder(name: string, type: KbFolderType): KbFolder {
  const trimmed = name.trim();
  const existing = folders.find(
    (f) => f.type === type && f.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;

  const folder: KbFolder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    type,
    createdAt: Date.now(),
    itemIds: [],
  };

  folders = [...folders, folder];
  saveFolders(folders);
  notify();
  return folder;
}

export function deleteFolder(id: string): void {
  folders = folders.filter((f) => f.id !== id);
  saveFolders(folders);
  notify();
}

/** Move an item into a folder: added to target, removed from every other folder of the same type. */
export function addItemToFolder(type: KbFolderType, folderId: string, itemId: string): void {
  folders = folders.map((f) => {
    if (f.type !== type) return f;
    const without = f.itemIds.filter((id) => id !== itemId);
    return f.id === folderId ? { ...f, itemIds: [...without, itemId] } : { ...f, itemIds: without };
  });
  saveFolders(folders);
  notify();
}

/** Remove an item from a folder (item goes back to "All"). */
export function removeItemFromFolder(type: KbFolderType, itemId: string): void {
  folders = folders.map((f) => {
    if (f.type !== type) return f;
    return { ...f, itemIds: f.itemIds.filter((id) => id !== itemId) };
  });
  saveFolders(folders);
  notify();
}

export function getFolderById(id: string): KbFolder | undefined {
  return folders.find((folder) => folder.id === id);
}
