/**
 * Live deployment smoke verification.
 *
 * Usage:
 *   node scripts/smoke-live.mjs [base-url]
 *
 * Default base URL is the production deployment. The script performs only
 * non-scanning requests (health, headers, validation errors) plus fixture-lab
 * listing, so it is safe to run often.
 */
const base = (process.argv[2] ?? 'https://argus-audit.argus-lab.workers.dev').replace(/\/+$/, '');
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: 'PASS', detail: detail ?? '' });
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check('GET /api/health → 200 ok', async () => {
  const response = await fetch(`${base}/api/health`);
  assert(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  assert(body.ok === true, 'ok !== true');
  assert(body.mode === 'live' || body.mode === 'fixture', `unexpected mode ${body.mode}`);
  assert(typeof body.aiExplanations === 'boolean', 'aiExplanations missing');
  return `mode=${body.mode} ai=${body.aiExplanations} methodology=${body.methodology}`;
});

await check('GET / → 200 html with security headers', async () => {
  const response = await fetch(`${base}/`);
  assert(response.status === 200, `status ${response.status}`);
  const required = [
    'content-security-policy',
    'x-content-type-options',
    'strict-transport-security',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
  ];
  for (const header of required) {
    assert(response.headers.get(header) !== null, `missing header ${header}`);
  }
  assert((response.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"), 'CSP weak');
  return required.join(', ');
});

await check('GET /api/unknown → 404 NOT_FOUND', async () => {
  const response = await fetch(`${base}/api/unknown`);
  assert(response.status === 404, `status ${response.status}`);
  const body = await response.json();
  assert(body.error?.code === 'NOT_FOUND', `code ${body.error?.code}`);
});

await check('POST /api/audit without acknowledgement → 400 (no scan)', async () => {
  const response = await fetch(`${base}/api/audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'example.com' }),
  });
  assert(response.status === 400, `status ${response.status}`);
  const body = await response.json();
  assert(body.error?.code === 'ACKNOWLEDGEMENT_REQUIRED', `code ${body.error?.code}`);
});

await check('POST /api/audit with empty url → 400 URL_REQUIRED (no scan)', async () => {
  const response = await fetch(`${base}/api/audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: '', acknowledged: true }),
  });
  assert(response.status === 400, `status ${response.status}`);
  const body = await response.json();
  assert(body.error?.code === 'URL_REQUIRED', `code ${body.error?.code}`);
});

await check('GET /api/audit → 405 METHOD_NOT_ALLOWED', async () => {
  const response = await fetch(`${base}/api/audit`);
  assert(response.status === 405, `status ${response.status}`);
});

await check('GET /api/methodology → scanners and rules', async () => {
  const response = await fetch(`${base}/api/methodology`);
  assert(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  assert(body.ok === true && Array.isArray(body.scanners) && Array.isArray(body.rules), 'shape invalid');
  return `${body.scanners.length} scanners, ${body.rules.length} rules, v${body.methodologyVersion}`;
});

await check('GET /api/lab/fixtures → three recorded fixtures', async () => {
  const response = await fetch(`${base}/api/lab/fixtures`);
  assert(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  assert(Array.isArray(body.fixtures) && body.fixtures.length === 3, `fixtures ${body.fixtures?.length}`);
  return body.fixtures.map((fixture) => fixture.id).join(', ');
});

await check('built bundle exposes no source map', async () => {
  const html = await (await fetch(`${base}/`)).text();
  const match = html.match(/\/assets\/[A-Za-z0-9._-]+\.js/);
  assert(match !== null, 'no bundle reference in html');
  const mapResponse = await fetch(`${base}${match[0]}.map`);
  if (mapResponse.status === 404) return `${match[0]}.map → 404`;
  const contentType = (mapResponse.headers.get('content-type') ?? '').split(';')[0];
  const body = await mapResponse.text();
  const looksLikeSourceMap = /"version"\s*:\s*3/.test(body) && /"sources"\s*:/.test(body);
  assert(!looksLikeSourceMap, 'an actual source map is served');
  assert(contentType === 'text/html', `unexpected content-type ${contentType} for a map path`);
  return `${match[0]}.map → ${mapResponse.status} ${contentType} (SPA fallback, no map)`;
});

let failed = 0;
for (const result of results) {
  if (result.status === 'FAIL') failed += 1;
  console.log(`${result.status}  ${result.name}${result.detail ? `  [${result.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed === 0 ? 0 : 1);
