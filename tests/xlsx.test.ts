import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkbook } from '../src/utils/xlsx.ts';

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

test('a workbook is a zip holding one sheet file per sheet', () => {
  const out = buildWorkbook([
    { name: 'Categories', header: ['Category'], rows: [['Software']] },
    { name: 'Bad:Name/1', header: ['A'], rows: [] },
  ]);
  assert.equal(text(out.slice(0, 2)), 'PK');
  const all = text(out);
  for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(all.includes(part), part);
  assert.ok(all.includes('name="Bad Name 1"'), 'characters Excel rejects are removed from sheet names');
});

test('cell text is escaped so it cannot break the XML', () => {
  const all = text(buildWorkbook([{ name: 'S', header: ['H'], rows: [['a & <b> "c"']] }]));
  assert.ok(all.includes('a &amp; &lt;b&gt; &quot;c&quot;'));
});
