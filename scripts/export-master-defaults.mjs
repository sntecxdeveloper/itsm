// Writes the built-in category / subcategory / item lists as JSON, which the backend loads into the ITSM master tables on first
// start when nothing has been saved yet. Usage: node scripts/export-master-defaults.mjs <output.json>
// (backend/src/main/resources/itsm/master-defaults.json in the dex repository). Needs Node 22.18+.
import { writeFileSync } from 'node:fs';
import { DEFAULT_CATEGORIES } from '../src/utils/categoryStore.ts';
import { getIssues } from '../src/utils/issueStore.ts';

const out = process.argv[2];
if (!out) throw new Error('Give the output file: node scripts/export-master-defaults.mjs <output.json>');
const categories = DEFAULT_CATEGORIES.map((c) => ({
  name: c.name,
  subcategories: c.subcategories.map((s) => ({ name: s, items: getIssues(s) })),
}));
writeFileSync(out, JSON.stringify({ categories }, null, 1) + '\n');
console.log(`${categories.length} categories written to ${out}`);
