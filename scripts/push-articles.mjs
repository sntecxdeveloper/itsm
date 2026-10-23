// Push markdown files to the KB as articles.
//
//   API=http://SERVER_IP:8080/api/v1 DEX_USER=admin DEX_PASS=secret \
//     node scripts/push-articles.mjs "<file-or-folder>" [--category Outlook] [--tags a,b] [--dry]
//
// Title  : first "## " heading (falls back to "# ", then the file name)
// Front-matter (optional "---" block at top): category, tags, severity, issue, status
// Existing articles with the same title are skipped, so re-running is safe.
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const dry = args.includes('--dry');
if (!target) { console.error('Usage: node push-articles.mjs <file-or-folder> [--category X] [--tags a,b] [--dry]'); process.exit(1); }

const BASE = process.env.API || 'http://localhost:8080/api/v1';
const cookies = {};
const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const call = async (method, url, body) => {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: jar(),
      ...(cookies['XSRF-TOKEN'] && { 'X-XSRF-TOKEN': decodeURIComponent(cookies['XSRF-TOKEN']) }),
    },
    body: body && JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(';'); const i = kv.indexOf('=');
    cookies[kv.slice(0, i).trim()] = kv.slice(i + 1);
  }
  return res;
};

function parse(file) {
  let raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const meta = {};
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    raw = raw.slice(fm[0].length);
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  const title = meta.title || raw.match(/^##\s+(.+)$/m)?.[1] || raw.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
  return {
    title: title.trim(),
    content: raw,
    category: meta.category || flag('category'),
    tags: meta.tags || flag('tags'),
    severity: meta.severity?.toUpperCase(),
    issue: meta.issue,
    status: meta.status || 'DRAFT',
  };
}

const files = fs.statSync(target).isDirectory()
  ? fs.readdirSync(target).filter((f) => f.endsWith('.md')).map((f) => path.join(target, f))
  : [target];
const articles = files.map(parse);

if (dry) {
  for (const a of articles) console.log(`[dry] "${a.title}" (${a.content.length} chars, category=${a.category ?? '-'})`);
  process.exit(0);
}

await call('GET', '/auth/me'); // picks up the XSRF-TOKEN cookie
const login = await call('POST', '/auth/login', { username: process.env.DEX_USER, password: process.env.DEX_PASS });
if (!login.ok) { console.error('Login failed:', login.status, await login.text()); process.exit(1); }

const existing = new Set(((await (await call('GET', '/knowledge')).json()).data ?? []).map((a) => a.title));
for (const a of articles) {
  if (existing.has(a.title)) { console.log('SKIP (exists)', a.title); continue; }
  const r = await call('POST', '/knowledge', a);
  console.log(r.ok ? 'OK  ' : `FAIL ${r.status}`, a.title, r.ok ? '' : await r.text());
}
