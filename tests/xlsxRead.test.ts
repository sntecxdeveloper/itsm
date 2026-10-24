import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWorkbook } from '../src/utils/xlsx.ts';
import { readWorkbook } from '../src/utils/xlsxRead.ts';

const buffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

// tests/fixtures/excel-sample.xlsx was saved the way Excel saves: compressed, with shared strings and formatted text.
test('reads a workbook saved by Excel: shared strings, escapes, numbers, gaps', async () => {
  const sheets = await readWorkbook(buffer(readFileSync(new URL('./fixtures/excel-sample.xlsx', import.meta.url))));
  assert.deepEqual(Object.keys(sheets), ['Categories', 'Rich']);
  assert.deepEqual(sheets.Categories[0], ['Category', 'Subcategory', 'Item', 'Assignment group']);
  assert.deepEqual(sheets.Categories[1], ['Software', 'Outlook', 'Outlook & Mail <slow>', 'Service Desk']);
  assert.deepEqual(sheets.Categories[2], ['Network', '', 'VPN "down"', '']);
  assert.deepEqual(sheets.Categories[3], ['Hardware', 'Printer', '42', 'ünïcode']);
  assert.equal(sheets.Rich[1][0], 'Bold and plain');
  assert.deepEqual(sheets.Rich[3], ['', '', 'far cell']);
});

test('reads back what the writer produces', async () => {
  const out = buildWorkbook([
    { name: 'Groups', header: ['Group', 'Status'], rows: [['Service Desk & Co', 'Active'], ['', 'x']] },
    { name: 'Empty', header: ['A'], rows: [] },
  ]);
  const sheets = await readWorkbook(buffer(out));
  assert.deepEqual(sheets.Groups, [['Group', 'Status'], ['Service Desk & Co', 'Active'], ['', 'x']]);
  assert.deepEqual(sheets.Empty, [['A']]);
});

test('refuses a file that is not an Excel workbook', async () => {
  await assert.rejects(() => readWorkbook(buffer(new TextEncoder().encode('Category,Subcategory\nA,B'))), /not an Excel/);
});
