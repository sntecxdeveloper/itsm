/**
 * A small Excel (.xlsx) writer, so a list can be downloaded without a spreadsheet library: text cells only, a bold
 * frozen header row, column widths and filters. An .xlsx is a zip of XML files; they are stored uncompressed here.
 */

export interface Sheet {
  /** Up to 31 characters; characters Excel does not allow in a sheet name are replaced. */
  name: string;
  header: string[];
  rows: string[][];
  /** Column widths in characters; a default is used for the ones left out. */
  widths?: number[];
}

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Characters XML cannot carry (control characters) are dropped, the rest escaped. */
const xml = (s: string) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const cell = (value: string, ref: string, style = 0) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;

function sheetXml(sheet: Sheet): string {
  const columns = sheet.header.length;
  const widths = sheet.header.map((_, i) => sheet.widths?.[i] ?? 24);
  const rows = [sheet.header, ...sheet.rows]
    .map((row, r) => `<row r="${r + 1}">${row.map((value, c) => cell(value ?? '', `${columnName(c)}${r + 1}`, r === 0 ? 1 : 0)).join('')}</row>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows}</sheetData>` +
    `<autoFilter ref="A1:${columnName(columns - 1)}${Math.max(sheet.rows.length + 1, 2)}"/>` +
    '</worksheet>'
  );
}

const sheetName = (name: string, index: number) => name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet${index + 1}`;

/** The zip file holding the given named files, uncompressed. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  // 1 January 2026, 00:00: the time stamp does not matter for a download.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(file.data.length), ...u32(file.data.length), ...u16(name.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...common, ...name]);
    parts.push(local, file.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + file.data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The bytes of an .xlsx workbook with one sheet per entry. */
export function buildWorkbook(sheets: Sheet[]): Uint8Array {
  const text = (name: string, content: string) => ({ name, data: encoder.encode(content) });
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zip([
    text(
      '[Content_Types].xml',
      `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ),
    text('_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    text(
      'xl/workbook.xml',
      `${head}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${xml(sheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    text(
      'xl/_rels/workbook.xml.rels',
      `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    ),
    text(
      'xl/styles.xml',
      `${head}<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
    ),
    ...sheets.map((s, i) => text(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s))),
  ]);
}

/** Saves the workbook through the browser's download. */
export function downloadWorkbook(fileName: string, sheets: Sheet[]) {
  const blob = new Blob([buildWorkbook(sheets) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
