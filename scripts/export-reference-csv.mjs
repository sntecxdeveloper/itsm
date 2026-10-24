// Writes docs/itsm-categories-and-priority.csv: the built-in category / subcategory / item lists and the
// impact x urgency -> priority table, as the New Incident page offers them. Run: node scripts/export-reference-csv.mjs
// Needs Node 22.18+ (it imports the TypeScript store files directly).
import { writeFileSync } from 'node:fs';
import { DEFAULT_CATEGORIES } from '../src/utils/categoryStore.ts';
import { getIssues } from '../src/utils/issueStore.ts';

// Same as LEVELS and derivedPriority in src/incident/pages/IncidentFormPage.tsx.
const LEVELS = ['1 - High', '2 - Medium', '3 - Low'];
const priorityOf = (impact, urgency) => {
  const sum = parseInt(impact, 10) + parseInt(urgency, 10);
  return sum <= 2 ? '1 - Critical' : sum === 3 ? '2 - High' : sum === 4 ? '3 - Moderate' : '4 - Low';
};

const cell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const rows = [['Type', 'Category', 'Subcategory', 'Item', 'Impact', 'Urgency', 'Priority']];

for (const c of DEFAULT_CATEGORIES) {
  for (const sub of c.subcategories) {
    for (const item of getIssues(sub)) rows.push(['Category', c.name, sub, item, '', '', '']);
  }
}
for (const impact of LEVELS) {
  for (const urgency of LEVELS) rows.push(['Priority', '', '', '', impact, urgency, priorityOf(impact, urgency)]);
}

const out = new URL('../docs/itsm-categories-and-priority.csv', import.meta.url);
// The BOM makes Excel read the file as UTF-8.
writeFileSync(out, '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
console.log(`${rows.length - 1} rows written to docs/itsm-categories-and-priority.csv`);
