/**
 * Reads the text of the sheets of an Excel (.xlsx) file, without a spreadsheet library. An .xlsx is a zip of XML files; the
 * browser's own DecompressionStream inflates them. Every cell comes back as text (numbers as written, empty cells as ''),
 * which is all the Setup imports need. Formulas are read as their last saved result.
 */

/** Sheet name → rows → cells. */
export type SheetRows = Record<string, string[][]>;

const decoder = new TextDecoder('utf-8');

const u16 = (v: DataView, at: number) => v.getUint16(at, true);
const u32 = (v: DataView, at: number) => v.getUint32(at, true);

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files inside the zip, by name, as text. Only the XML parts are unpacked. */
async function unzipXml(data: ArrayBuffer): Promise<Map<string, string>> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(view, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('This is not an Excel (.xlsx) file.');
  const count = u16(view, end + 10);
  let at = u32(view, end + 16);
  const files = new Map<string, string>();
  for (let n = 0; n < count; n++) {
    if (u32(view, at) !== 0x02014b50) throw new Error('The Excel file is damaged.');
    const method = u16(view, at + 10);
    const size = u32(view, at + 20);
    const nameLength = u16(view, at + 28);
    const extraLength = u16(view, at + 30);
    const commentLength = u16(view, at + 32);
    const local = u32(view, at + 42);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const packed = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, decoder.decode(packed));
    else if (method === 8) files.set(name, decoder.decode(await inflate(packed)));
    else throw new Error('The Excel file uses a compression this page cannot read.');
  }
  return files;
}

const unescapeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** The text of every <t> in a piece of XML (a shared string can be split into formatted runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** 'C12' → 2 (the zero-based column). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const index = Number(attr(row[1], 'r') ?? rows.length + 1) - 1;
    const cells: string[] = [];
    for (const c of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r');
      const col = ref ? columnIndex(ref) : cells.length;
      const type = attr(c[1], 't');
      const body = c[2] ?? '';
      let value = '';
      if (type === 'inlineStr') value = textOf(body);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v !== undefined) value = type === 's' ? (shared[Number(v)] ?? '') : unescapeXml(v);
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    while (rows.length < index) rows.push([]);
    rows[index] = cells;
  }
  return rows;
}

/** Every sheet of the workbook with its text cells. */
export async function readWorkbook(data: ArrayBuffer): Promise<SheetRows> {
  const files = await unzipXml(data);
  const workbook = files.get('xl/workbook.xml');
  if (!workbook) throw new Error('This is not an Excel (.xlsx) file.');
  const rels = files.get('xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map<string, string>();
  for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(r[0], 'Id');
    const target = attr(r[0], 'Target');
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const out: SheetRows = {};
  for (const s of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unescapeXml(attr(s[0], 'name') ?? '');
    const target = targets.get(/\sr:id="([^"]*)"/.exec(s[0])?.[1] ?? '');
    const xml = target ? files.get(target) : undefined;
    if (name && xml) out[name] = parseSheet(xml, shared);
  }
  return out;
}
