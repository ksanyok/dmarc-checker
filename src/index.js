import { resolveTxt as dnsResolveTxt } from 'node:dns/promises';
import { isDmarc, parseDmarc, lintDmarc, parseUris } from './parse.js';

export { isDmarc, parseDmarc, lintDmarc, parseUris } from './parse.js';

async function defaultResolveTxt(name) {
  const records = await dnsResolveTxt(name);
  return records.map((chunks) => chunks.join(''));
}

function cleanDomain(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) throw new TypeError('A domain is required');
  return s.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '').replace(/^_dmarc\./, '');
}

/**
 * Naive organizational domain: the last two labels, or three for common two-level suffixes.
 * Good enough for a fallback lookup; pass options.orgDomain to override.
 */
export function organizationalDomain(domain) {
  const labels = domain.split('.');
  const twoLevel = /^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$|^com\.(ua|pl|au|br|tr)$/;
  const n = labels.length >= 3 && twoLevel.test(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-n).join('.');
}

async function txtOrEmpty(resolveTxt, name) {
  try { return await resolveTxt(name); } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') return [];
    throw err;
  }
}

/**
 * Look up and evaluate the DMARC policy of a domain.
 * @param {string} domain
 * @param {{resolveTxt?: (name: string) => Promise<string[]>, checkReportAuth?: boolean, orgDomain?: string}} [options]
 */
export async function checkDmarc(domain, options = {}) {
  const resolveTxt = options.resolveTxt || defaultResolveTxt;
  const name = cleanDomain(domain);
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });

  let source = name;
  let records = (await txtOrEmpty(resolveTxt, `_dmarc.${name}`)).filter(isDmarc);
  const org = options.orgDomain || organizationalDomain(name);
  if (!records.length && org !== name) {
    records = (await txtOrEmpty(resolveTxt, `_dmarc.${org}`)).filter(isDmarc);
    if (records.length) { source = org; add('info', 'inherited', `${name} has no own record; the policy of ${org} applies (sp= if set).`); }
  }
  if (!records.length) {
    add('error', 'no-dmarc', `No DMARC record at _dmarc.${name}. Receivers apply no policy and spoofed mail is not blocked.`);
    return { domain: name, source: null, record: null, tags: {}, policy: null, issues, ok: false };
  }
  if (records.length > 1) add('error', 'multiple-dmarc', `_dmarc.${source} has ${records.length} DMARC records; receivers ignore all of them.`);
  const record = records[0];
  const parsed = parseDmarc(record);
  for (const e of parsed.errors) add('error', 'syntax', e);
  issues.push(...lintDmarc(record, parsed));

  if (options.checkReportAuth !== false) {
    const dests = new Set();
    for (const t of ['rua', 'ruf']) {
      for (const u of parseUris(parsed.tags[t] || '')) {
        if (u.valid && u.domain !== source && !u.domain.endsWith(`.${source}`)) dests.add(u.domain);
      }
    }
    for (const dest of dests) {
      const auth = (await txtOrEmpty(resolveTxt, `${source}._report._dmarc.${dest}`)).filter(isDmarc);
      if (!auth.length) add('warning', 'report-not-authorized', `${dest} has not authorized reports for ${source} (no TXT at ${source}._report._dmarc.${dest}); receivers may drop them.`);
    }
  }

  const effective = source === name ? parsed.tags.p : (parsed.tags.sp || parsed.tags.p);
  return {
    domain: name, source, record, tags: parsed.tags, policy: effective?.toLowerCase() || null,
    issues, ok: !issues.some((i) => i.level === 'error'),
  };
}
