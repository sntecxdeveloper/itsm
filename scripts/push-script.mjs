// Push a .ps1 file to the KB as a script (created as DRAFT, still needs Submit + Approve in the UI).
//
//   API=http://SERVER_IP:8080/api/v1 DEX_USER=admin DEX_PASS=secret \
//     node scripts/push-script.mjs "<file.ps1>" \
//       --title "Resolve Outlook connectivity" --risk MEDIUM --timeout 120 --admin \
//       --issue-match "outlook,connectivity" --article "<exact article title>" \
//       --params '[{"name":"ResetCredentials","type":"bool","default":false}]' [--dry]
//
// Description is taken from the .SYNOPSIS block of the script when present.
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const file = args[0]?.startsWith('--') ? undefined : args[0]; // the .ps1 path must come first
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
if (!file) { console.error('Usage: node push-script.mjs <file.ps1> [--title ..] [--risk LOW|MEDIUM|HIGH] [--timeout N] [--admin] [--issue-match ..] [--article <title>] [--params <json>] [--dry]'); process.exit(1); }

const content = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
const synopsis = content.match(/\.SYNOPSIS\s+([\s\S]*?)\r?\n\s*\r?\n/)?.[1]?.trim().replace(/\s*\r?\n\s*/g, ' ');
const input = {
  title: flag('title') || path.basename(file, '.ps1'),
  description: flag('description') || synopsis,
  language: 'powershell',
  content,
  requiresAdmin: args.includes('--admin'),
  riskLevel: (flag('risk') || 'MEDIUM').toUpperCase(),
  timeoutSeconds: Number(flag('timeout') || 120),
  supportedOs: flag('os') || 'Windows',
  issueMatch: flag('issue-match') || null,
  parametersSchema: flag('params') || null,
  autoRun: false,
};
if (input.parametersSchema) JSON.parse(input.parametersSchema); // fail early on bad JSON

if (args.includes('--dry')) {
  console.log('[dry]', { ...input, content: `${content.length} chars` });
  process.exit(0);
}

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

await call('GET', '/auth/me');
const login = await call('POST', '/auth/login', { username: process.env.DEX_USER, password: process.env.DEX_PASS });
if (!login.ok) { console.error('Login failed:', login.status, await login.text()); process.exit(1); }

if (flag('article')) {
  const list = (await (await call('GET', '/knowledge')).json()).data ?? [];
  const art = list.find((a) => a.title === flag('article'));
  if (!art) { console.error(`Article not found: "${flag('article')}" - push the article first.`); process.exit(1); }
  input.articleId = art.id;
}

const r = await call('POST', '/knowledge/scripts', input);
console.log(r.ok ? 'OK  ' : `FAIL ${r.status}`, input.title, r.ok ? '' : await r.text());
