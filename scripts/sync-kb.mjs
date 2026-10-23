// Copy KB articles, scripts and screenshots from one DEX backend to another
// (e.g. local -> server). Nothing is deleted or overwritten on the destination:
// items whose title already exists there are skipped, so re-running is safe.
//
//   SRC_API=http://localhost:8080/api/v1        SRC_USER=admin  SRC_PASS=secret \
//   DST_API=https://192.168.31.147/api/v1       DST_USER=sntecx DST_PASS=... \
//   NODE_TLS_REJECT_UNAUTHORIZED=0 \
//     node scripts/sync-kb.mjs [--dry]
//
// Scripts arrive as DRAFT (the API can't create approved ones): submit and approve them
// on the destination. Only the latest version of each script is copied.
const env = (k) => process.env[k] || (console.error(`Missing ${k}`), process.exit(1));
const dry = process.argv.includes('--dry');

function client(base, user, pass) {
  const cookies = {};
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
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
  return {
    async login() {
      await call('GET', '/auth/me');
      const r = await call('POST', '/auth/login', { username: user, password: pass });
      if (!r.ok) throw new Error(`Login failed at ${base}: ${r.status} ${await r.text()}`);
    },
    async get(url) {
      const r = await call('GET', url);
      if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
      return (await r.json()).data ?? [];
    },
    post: async (url, body) => {
      const r = await call('POST', url, body);
      if (!r.ok) throw new Error(`POST ${url} -> ${r.status} ${await r.text()}`);
      return (await r.json()).data;
    },
  };
}

const src = client(env('SRC_API'), env('SRC_USER'), env('SRC_PASS'));
const dst = client(env('DST_API'), env('DST_USER'), env('DST_PASS'));
await src.login();
await dst.login();

// ---- articles ----
const srcArticles = await src.get('/knowledge');
const dstArticles = await dst.get('/knowledge');
const dstArticleByTitle = new Map(dstArticles.map((a) => [a.title, a.id]));
const articleIdMap = new Map(); // source id -> destination id
let created = 0, skipped = 0;

for (const a of srcArticles) {
  if (dstArticleByTitle.has(a.title)) {
    articleIdMap.set(a.id, dstArticleByTitle.get(a.title));
    skipped++;
    console.log('SKIP article (exists):', a.title);
    continue;
  }
  if (dry) { console.log('[dry] article:', a.title); created++; continue; }
  const made = await dst.post('/knowledge', {
    title: a.title, content: a.content, category: a.category, tags: a.tags,
    author: a.author, status: a.status || 'DRAFT', issue: a.issue, severity: a.severity,
  });
  articleIdMap.set(a.id, made.id);
  created++;
  console.log('OK   article:', a.title);

  for (const s of await src.get(`/knowledge/${a.id}/screenshots`)) {
    await dst.post(`/knowledge/${made.id}/screenshots`, { caption: s.caption, imageData: s.imageData });
    console.log('       + screenshot', s.caption || '');
  }
}
console.log(`Articles: ${created} created, ${skipped} skipped\n`);

// ---- scripts (latest version of each key) ----
const latest = new Map();
for (const s of await src.get('/knowledge/scripts')) {
  const cur = latest.get(s.scriptKey);
  if (!cur || s.version > cur.version) latest.set(s.scriptKey, s);
}
const dstScriptKeys = new Set((await dst.get('/knowledge/scripts')).map((s) => s.title));

created = 0; skipped = 0;
for (const s of latest.values()) {
  if (dstScriptKeys.has(s.title)) { skipped++; console.log('SKIP script (exists):', s.title); continue; }
  if (dry) { console.log('[dry] script:', s.title, '-> article', articleIdMap.get(s.articleId) ?? '(none)'); created++; continue; }
  await dst.post('/knowledge/scripts', {
    articleId: s.articleId != null ? articleIdMap.get(s.articleId) ?? null : null,
    title: s.title, description: s.description, language: s.language, content: s.content,
    requiresAdmin: s.requiresAdmin, riskLevel: s.riskLevel, timeoutSeconds: s.timeoutSeconds,
    supportedOs: s.supportedOs, parametersSchema: s.parametersSchema, issueMatch: s.issueMatch,
    autoRun: false, checkScript: s.checkScript, verifyScript: s.verifyScript, undoScript: s.undoScript,
  });
  created++;
  console.log('OK   script:', s.title);
}
console.log(`Scripts: ${created} created, ${skipped} skipped`);
