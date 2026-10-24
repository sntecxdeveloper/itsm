export interface Category {
  name: string;
  subcategories: string[];
}

// The categories and subcategories come from the database (the ITSM master data, filled by Setup → Categories → Import from Excel);
// a copy is kept in this browser when the person signs in, so the forms can read it synchronously. Nothing is built in.
const KEY = 'dex.setup.categories';

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Category[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* unreadable or storage blocked: no categories */
  }
  return [];
}

/** Returns false when the browser refused the write. */
export function saveCategories(list: Category[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Category name → its subcategories, for the incident and problem forms. */
export function getCategoryMap(): Record<string, string[]> {
  return Object.fromEntries(loadCategories().map((x) => [x.name, x.subcategories]));
}
