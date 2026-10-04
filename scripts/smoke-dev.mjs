/**
 * Live dev-server smoke test. Unlike responsive-audit.mjs (which serves the
 * built dist/ and is a release gate), this points at the running dev server to
 * confirm the routes respond after a source edit.
 *
 * Usage: node scripts/smoke-dev.mjs [origin]
 */
// Astro's default dev port. This used to say 4322, which made a bare
// `npm run smoke-dev` fail every time with "fetch failed" while the server was
// up and serving on 4321. Override by passing an origin.
const ORIGIN = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');

const ROUTES = [
  '/',
  '/services/',
  '/data-recovery/',
  '/computer-repair-bongaree/',
  '/service-area/',
  '/pricing/',
  '/contact/',
  '/quote/',
  '/blog/',
  '/about/',

  '/search/',
];

/**
 * Paths that must return 404 *and* the branded not-found page. A 404 route
 * answering 200 would be wrong, so these are checked separately rather than
 * folded into the 200 list.
 */
const NOT_FOUND = ['/404.html', '/this-page-does-not-exist/'];

let failed = 0;
console.log(`Smoke testing ${ORIGIN}\n`);

for (const route of ROUTES) {
  const started = process.hrtime.bigint();
  try {
    const res = await fetch(ORIGIN + route, { redirect: 'manual' });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const ok = res.status === 200;
    if (!ok) failed++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${route.padEnd(30)} ${res.status}  ${ms.toFixed(0)}ms`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${route.padEnd(30)} ${String(err).slice(0, 80)}`);
  }
}

console.log('');
for (const route of NOT_FOUND) {
  try {
    const res = await fetch(ORIGIN + route, { redirect: 'manual' });
    const body = await res.text();
    const branded = /<title>Page not found/i.test(body);
    const ok = res.status === 404 && branded;
    if (!ok) failed++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${route.padEnd(30)} ${res.status} branded-404=${branded}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${route.padEnd(30)} ${String(err).slice(0, 80)}`);
  }
}

const total = ROUTES.length + NOT_FOUND.length;
console.log('\n' + '='.repeat(60));
console.log(failed === 0
  ? `PASS: ${ROUTES.length} routes 200, ${NOT_FOUND.length} 404 routes correct.`
  : `${failed} of ${total} failed.`);
process.exit(failed === 0 ? 0 : 1);