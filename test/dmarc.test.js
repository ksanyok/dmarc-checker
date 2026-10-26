import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDmarc, parseDmarc, lintDmarc, organizationalDomain } from '../src/index.js';

const dns = (map) => async (name) => {
  if (!(name in map)) { const e = new Error('not found'); e.code = 'ENOTFOUND'; throw e; }
  return map[name];
};
const codes = (r) => r.issues.map((i) => i.code);

test('parses a valid record without errors', () => {
  const { tags, errors } = parseDmarc('v=DMARC1; p=reject; sp=quarantine; pct=100; rua=mailto:d@example.com!10m; adkim=s');
  assert.deepEqual(errors, []);
  assert.equal(tags.p, 'reject');
  assert.equal(tags.sp, 'quarantine');
});

test('reports syntax errors', () => {
  const { errors } = parseDmarc('p=reject; v=DMARC1; pct=150; adkim=x; foo=bar; rua=https://x');
  assert.ok(errors.some((e) => e.includes('start with')));
  assert.ok(errors.some((e) => e.includes('pct=150')));
  assert.ok(errors.some((e) => e.includes('adkim=x')));
  assert.ok(errors.some((e) => e.includes('Unknown tag "foo"')));
  assert.ok(errors.some((e) => e.includes('mailto')));
});

test('missing policy is an error', () => {
  assert.ok(parseDmarc('v=DMARC1; rua=mailto:a@b.com').errors.some((e) => e.includes('"p"')));
});

test('lints weak policies', () => {
  const c = lintDmarc('v=DMARC1; p=none').map((i) => i.code);
  assert.ok(c.includes('policy-none'));
  assert.ok(c.includes('no-rua'));
  const c2 = lintDmarc('v=DMARC1; p=reject; pct=20; sp=none; rua=mailto:a@b.com').map((i) => i.code);
  assert.ok(c2.includes('partial-pct'));
  assert.ok(c2.includes('weak-subdomain-policy'));
});

test('organizational domain', () => {
  assert.equal(organizationalDomain('mail.news.example.com'), 'example.com');
  assert.equal(organizationalDomain('shop.example.co.uk'), 'example.co.uk');
  assert.equal(organizationalDomain('example.com.ua'), 'example.com.ua');
});

test('checks a domain and flags unauthorized report destinations', async () => {
  const r = await checkDmarc('example.com', { resolveTxt: dns({
    '_dmarc.example.com': ['v=DMARC1; p=reject; rua=mailto:a@reports.test,mailto:b@ok.test'],
    'example.com._report._dmarc.ok.test': ['v=DMARC1'],
  }) });
  assert.equal(r.policy, 'reject');
  assert.ok(r.ok);
  const unauth = r.issues.filter((i) => i.code === 'report-not-authorized');
  assert.equal(unauth.length, 1);
  assert.match(unauth[0].message, /reports\.test/);
});

test('falls back to the organizational domain and uses sp', async () => {
  const r = await checkDmarc('mail.example.com', { resolveTxt: dns({ '_dmarc.example.com': ['v=DMARC1; p=reject; sp=quarantine; rua=mailto:d@example.com'] }) });
  assert.equal(r.source, 'example.com');
  assert.equal(r.policy, 'quarantine');
  assert.ok(codes(r).includes('inherited'));
});

test('no record and multiple records', async () => {
  const none = await checkDmarc('example.com', { resolveTxt: dns({}) });
  assert.equal(none.ok, false);
  assert.ok(codes(none).includes('no-dmarc'));
  const two = await checkDmarc('example.com', { resolveTxt: dns({ '_dmarc.example.com': ['v=DMARC1; p=none', 'v=DMARC1; p=reject'] }) });
  assert.ok(codes(two).includes('multiple-dmarc'));
});

test('accepts URLs and _dmarc prefixes as input', async () => {
  const r = await checkDmarc('https://_dmarc.Example.com/', { resolveTxt: dns({ '_dmarc.example.com': ['v=DMARC1; p=quarantine; rua=mailto:d@example.com'] }) });
  assert.equal(r.domain, 'example.com');
  assert.ok(r.ok);
});
