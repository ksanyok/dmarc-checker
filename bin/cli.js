#!/usr/bin/env node
import { checkDmarc, parseDmarc, lintDmarc } from '../src/index.js';

const HELP = `Usage: dmarc-checker <domain> [options]
       dmarc-checker --record "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

Looks up _dmarc.<domain> (falling back to the organizational domain), validates
every tag and reports weak policies and unauthorized report destinations.

Options:
  --record <dmarc>  Lint a record string offline instead of querying DNS
  --json            Print the full report as JSON
  --no-report-auth  Skip the external report destination check
  --strict          Exit with code 1 on warnings too
  -h, --help        Show this help

Online version (no install): https://promopilot.link/en/tools/dmarc-checker.php
`;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!args.length || flag('-h') || flag('--help')) { process.stdout.write(HELP); process.exit(args.length ? 0 : 2); }

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ICON = { error: c(31, '✖'), warning: c(33, '!'), info: c(36, 'i') };
const NAMES = { p: 'Policy', sp: 'Subdomain policy', np: 'Non-existent subdomains', pct: 'Percentage', adkim: 'DKIM alignment', aspf: 'SPF alignment', rua: 'Aggregate reports', ruf: 'Forensic reports', fo: 'Failure options', ri: 'Report interval' };

try {
  let report;
  if (value('--record')) {
    const record = value('--record');
    const parsed = parseDmarc(record);
    const issues = [...parsed.errors.map((m) => ({ level: 'error', code: 'syntax', message: m })), ...lintDmarc(record, parsed)];
    report = { record, tags: parsed.tags, policy: parsed.tags.p?.toLowerCase() || null, issues, ok: !issues.some((i) => i.level === 'error') };
  } else {
    report = await checkDmarc(args.find((a) => !a.startsWith('-')), { checkReportAuth: !flag('--no-report-auth') });
  }
  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.domain) console.log(`${c(1, 'Domain:')} ${report.domain}${report.source && report.source !== report.domain ? ` (policy from ${report.source})` : ''}`);
    console.log(`${c(1, 'Record:')} ${report.record || '(none)'}`);
    if (report.policy) console.log(`${c(1, 'Effective policy:')} ${report.policy}`);
    const tags = Object.entries(report.tags || {}).filter(([k]) => NAMES[k]);
    if (tags.length) { console.log(''); for (const [k, v] of tags) console.log(`  ${(NAMES[k] + ':').padEnd(26)} ${k}=${v}`); }
    console.log('');
    if (!report.issues.length) console.log(c(32, '✔ DMARC looks good'));
    for (const i of report.issues) console.log(`  ${ICON[i.level]} ${i.message}`);
  }
  const failing = report.issues.filter((i) => i.level === 'error' || (flag('--strict') && i.level === 'warning'));
  process.exit(failing.length ? 1 : 0);
} catch (err) {
  console.error(c(31, `Error: ${err.message}`));
  process.exit(2);
}
