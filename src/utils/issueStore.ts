// The items offered in the Item field of a new incident once a subcategory is chosen. They come from the database (the ITSM master
// data, filled by Setup → Categories → Import from Excel); a copy is kept in this browser when the person signs in, so the form
// can read it synchronously. Nothing is built in: a subcategory without items offers none.
const KEY = 'dex.setup.issues';

function loadAll(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The items of a subcategory. */
export function getIssues(subcategory: string): string[] {
  if (!subcategory) return [];
  return loadAll()[subcategory] ?? [];
}

/** Saves the items of a subcategory. Returns false when the browser refused the write. */
export function saveIssues(subcategory: string, issues: string[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadAll(), [subcategory]: issues }));
    return true;
  } catch {
    return false;
  }
}
