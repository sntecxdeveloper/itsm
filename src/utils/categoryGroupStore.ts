// Which assignment group handles each category (Setup → Category & Subcategory). The backend has no such table yet,
// so the mapping lives in this browser, like the category list itself.
const KEY = 'dex.setup.categoryGroups';

export function loadCategoryGroups(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The key a subcategory's group is stored under. */
export const subcategoryKey = (category: string, subcategory: string) => `${category}::${subcategory}`;

/** An empty group name removes the mapping. Returns false when the browser refused the write. */
export function setCategoryGroup(category: string, group: string): boolean {
  // (for a subcategory, pass subcategoryKey(category, subcategory) as `category`)
  const map = loadCategoryGroups();
  if (group) map[category] = group;
  else delete map[category];
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}
